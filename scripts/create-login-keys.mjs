#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const envFiles = ['.env.local', '.env']

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return

  const content = readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function parseArgs(argv) {
  const options = {
    count: 1,
    prefix: '内测用户',
    emailDomain: 'internal.resume-parser.test',
    verify: true,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--count' || arg === '-c') {
      options.count = Number.parseInt(next, 10)
      index += 1
      continue
    }

    if (arg === '--prefix' || arg === '-p') {
      options.prefix = next
      index += 1
      continue
    }

    if (arg === '--email-domain') {
      options.emailDomain = next
      index += 1
      continue
    }

    if (arg === '--no-verify') {
      options.verify = false
      continue
    }

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 100) {
    throw new Error('--count must be an integer between 1 and 100')
  }

  if (!options.prefix) {
    throw new Error('--prefix cannot be empty')
  }

  if (!/^[^\s@]+(\.[^\s@]+)+$/.test(options.emailDomain)) {
    throw new Error('--email-domain must look like a domain, for example internal.example.test')
  }

  return options
}

function printHelp() {
  console.log(`
Create Supabase login keys for local admin use.

Usage:
  npm run keys:create -- --count 10 --prefix "内测用户"

Options:
  -c, --count <number>          Number of keys to create, 1-100. Default: 1
  -p, --prefix <text>           key_name prefix. Default: 内测用户
      --email-domain <domain>   Synthetic Auth email domain. Default: internal.resume-parser.test
      --no-verify               Skip auth-sign-in verification
`)
}

function requiredEnv(name, fallbackName) {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : undefined)
  if (!value) {
    const hint = fallbackName ? `${name} or ${fallbackName}` : name
    throw new Error(`Missing environment variable: ${hint}`)
  }
  return value
}

function generateLoginKey() {
  return `sk-${randomBytes(32).toString('base64url')}`
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex')
}

function formatIndex(index, total) {
  const width = Math.max(String(total).length, 2)
  return String(index).padStart(width, '0')
}

function buildEmail(prefix, index, timestamp, domain) {
  const safePrefix = prefix
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'login-key'
  const suffix = randomBytes(4).toString('hex')
  return `${safePrefix}-${timestamp}-${formatIndex(index, 100)}-${suffix}@${domain}`
}

async function verifyLogin(edgeFunctionsUrl, loginKey) {
  const response = await fetch(`${edgeFunctionsUrl.replace(/\/$/, '')}/auth-sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: loginKey }),
  })

  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text }
  }

  if (!response.ok || !body?.success || !body?.session?.access_token) {
    throw new Error(`auth-sign-in verification failed: HTTP ${response.status} ${text}`)
  }
}

async function createLoginKey({ adminClient, edgeFunctionsUrl, options, index, timestamp }) {
  const label = formatIndex(index, options.count)
  const keyName = `${options.prefix}${label}`
  const email = buildEmail(options.prefix, index, timestamp, options.emailDomain)
  const loginKey = generateLoginKey()
  const keyHash = sha256Hex(loginKey)
  const password = randomBytes(32).toString('base64url')

  const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { key_name: keyName },
  })

  if (userError || !userData.user) {
    throw new Error(`Failed to create Auth user for ${keyName}: ${userError?.message || 'missing user'}`)
  }

  const userId = userData.user.id
  const { data: keyRow, error: insertError } = await adminClient
    .from('valid_keys')
    .insert({
      user_id: userId,
      key_hash: keyHash,
      key_name: keyName,
      is_active: true,
    })
    .select('id')
    .single()

  if (insertError || !keyRow) {
    await adminClient.auth.admin.deleteUser(userId)
    throw new Error(`Failed to insert valid_keys row for ${keyName}: ${insertError?.message || 'missing row'}`)
  }

  if (options.verify) {
    try {
      await verifyLogin(edgeFunctionsUrl, loginKey)
      await adminClient
        .from('valid_keys')
        .update({ last_used_at: null })
        .eq('id', keyRow.id)
    } catch (error) {
      await adminClient
        .from('valid_keys')
        .delete()
        .eq('id', keyRow.id)
      await adminClient.auth.admin.deleteUser(userId)
      throw error
    }
  }

  return {
    keyName,
    email,
    userId,
    loginKey,
  }
}

async function main() {
  for (const file of envFiles) {
    loadEnvFile(resolve(process.cwd(), file))
  }

  const options = parseArgs(process.argv.slice(2))
  const supabaseUrl = requiredEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const edgeFunctionsUrl = process.env.EDGE_FUNCTIONS_URL ||
    process.env.VITE_EDGE_FUNCTIONS_URL ||
    `${supabaseUrl.replace(/\/$/, '')}/functions/v1`

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const timestamp = Date.now()
  const created = []

  try {
    for (let index = 1; index <= options.count; index += 1) {
      const item = await createLoginKey({
        adminClient,
        edgeFunctionsUrl,
        options,
        index,
        timestamp,
      })
      created.push(item)
      console.error(`Created and ${options.verify ? 'verified' : 'stored'} ${item.keyName}`)
    }
  } catch (error) {
    if (created.length > 0) {
      console.log(JSON.stringify({
        createdAt: new Date().toISOString(),
        partial: true,
        verified: options.verify,
        keys: created,
      }, null, 2))
    }
    throw error
  }

  console.log(JSON.stringify({
    createdAt: new Date().toISOString(),
    verified: options.verify,
    keys: created,
  }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
