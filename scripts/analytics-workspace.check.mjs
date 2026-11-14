import assert from 'node:assert/strict'

// Real browser and PostgreSQL, intercepted Supabase transport; no live writes.
export async function checkAnalytics({ page, db, origin, user, supabaseUrl, screenshot }) {
  await page.addInitScript(() => localStorage.setItem('sidebar-trigger-hint-dismissed', '1'))
  const batch = crypto.randomUUID(), resume = crypto.randomUUID(), emptyBatch = crypto.randomUUID()
  await db.query(`insert into recruitment_batches(id,user_id,name,color) values($1,$3,'面板验收','blue'),($2,$3,'空面板验收','teal')`, [batch, emptyBatch, user])
  await db.query(`insert into resumes(id,user_id,batch_id,title,content) values($1,$2,$3,'面板产品简历','{}')`, [resume, user, batch])
  const statuses = ['interested', 'applied', 'assessing', 'interviewing', 'offered', 'rejected']
  for (let index = 0; index < 25; index++) await db.query(`insert into applications(user_id,batch_id,resume_id,company,position,channel,status,applied_at) values($1,$2,$3,$4,'产品经理','官网',$5,$6)`, [user, batch, index < 3 ? null : resume, `面板公司${String(index).padStart(2, '0')}`, statuses[index % statuses.length], index === 23 ? '2020-01-01' : new Date().toISOString()])
  const widget = name => page.getByRole('article', { name, exact: true })
  const total = widget('总投递数')
  const waitForTop = (name, top, shift = 0) => page.waitForFunction(({ name, top, shift }) => {
    const node = [...document.querySelectorAll('article')].find(node => node.getAttribute('aria-label') === name)
    if (!node) return false
    const y = node.getBoundingClientRect().y
    return shift ? y > top + shift : Math.abs(y - top) < 2
  }, { name, top, shift })
  const waitTotal = async value => { await page.waitForFunction(value => document.querySelector('article[aria-label="总投递数"] .analytics-stat-value')?.textContent === String(value), value) }
  const add = async name => {
    await page.getByRole('button', { name: '添加模块', exact: true }).click()
    const library = page.getByRole('dialog', { name: '添加模块', exact: true })
    const button = library.getByRole('button', { name: `添加${name}`, exact: true })
    if (!await button.count()) await library.getByRole('tab', { selected: false }).click()
    await button.click()
  }
  const read = async () => (await db.query('select config,revision from dashboard_configs where user_id=$1', [user])).rows[0]
  const save = async () => { await page.getByRole('button', { name: '保存看板', exact: true }).click(); await page.getByRole('button', { name: '编辑看板', exact: true }).waitFor() }
  const chartsFit = async () => {
    try { await page.waitForFunction(() => [...document.querySelectorAll('.board-widget .analytics-chart')].every(chart => {
      const canvas = chart.querySelector('canvas')
      if (!canvas) return chart.textContent.includes('暂无')
      const a = chart.getBoundingClientRect(), b = canvas.getBoundingClientRect()
      return a.height > 100 && Math.abs(a.height - b.height) < 3 && Math.abs(a.width - b.width) < 3
    })) } catch (error) {
      console.error('[analytics] chart bounds', await page.locator('.board-widget .analytics-chart').evaluateAll(charts => charts.map(chart => {
        const rect = el => el ? { width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, style: el.getAttribute('style') } : null
        return { container: rect(chart), wrapper: rect(chart.querySelector('.echarts-for-react')), canvas: rect(chart.querySelector('canvas')) }
      })))
      throw error
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  // The app replaces obsolete query parameters during its initial navigation.
  // Wait for the committed document, then assert readiness through the UI.
  await page.goto(`${origin}/analytics?batch=${batch}&view=table&sort=company&order=asc&page=2`, { waitUntil: 'commit' })
  await page.getByRole('button', { name: '编辑看板', exact: true }).waitFor()
  await waitTotal(20)
  assert.equal(await page.getByRole('article').count(), 6)
  if (process.env.WORKSPACE_WIDGET_LIBRARY_ONLY === '1') {
    await page.getByRole('button', { name: '编辑看板', exact: true }).click()
    if (process.env.WORKSPACE_RESIZE_ONLY === '1') {
      await add('状态占比')
      const unit = ((await page.locator('.board-grid-container').boundingBox()).width + 16) / 12
      const cases = [
        ['总投递数', 'e', '面试中', .75 * unit, 0, 100],
        ['总投递数', 's', '状态分布', 0, 80, 100],
        ['总投递数', 'se', '面试中', .75 * unit, 80, 100],
        ['面试中', 'w', '总投递数', -.75 * unit, 0, 100],
        ['状态分布', 'e', '关系图谱', .75 * unit, 0, 200],
        ['状态分布', 's', '状态占比', 0, 120, 100],
        ['状态分布', 'se', '关系图谱', .75 * unit, 120, 200],
        ['关系图谱', 'w', '状态分布', -.75 * unit, 0, 200],
      ]
      for (const [name, direction, neighbor, dx, dy, shift] of cases) {
        const panel = widget(name)
        const handle = panel.locator('..').locator(`.react-resizable-handle-${direction}`)
        await handle.scrollIntoViewIfNeeded()
        const before = await panel.boundingBox(), edge = await handle.boundingBox(), adjacent = await widget(neighbor).boundingBox()
        const x = edge.x + edge.width / 2, y = edge.y + edge.height / 2
        await page.mouse.move(x, y); await page.mouse.down()
        await page.mouse.move(x + dx, y + dy, { steps: 14 })
        await waitForTop(neighbor, adjacent.y, shift)
        const expanded = await panel.boundingBox()
        if (direction === 'w') {
          assert.ok(expanded.x < before.x - 30, 'West resizing moves the left edge')
          assert.ok(Math.abs(expanded.x + expanded.width - before.x - before.width) < 2, 'West resizing anchors the right edge')
          assert.ok(Math.abs(expanded.height - before.height) < 2, 'West resizing preserves height')
        }
        assert.ok(!dx || expanded.width > before.width + 30, `${name} grows horizontally into the occupied next size`)
        assert.ok(!dy || expanded.height > before.height + 40, `${name} grows vertically into the occupied next size`)
        await screenshot(`analytics-resize-${name}-${direction}`)
        await page.mouse.move(x, y, { steps: 14 })
        await waitForTop(neighbor, adjacent.y)
        await page.mouse.up()
        const restored = await panel.boundingBox()
        assert.ok(Math.abs(restored.x - before.x) < 2, 'Shrinking restores the original horizontal position')
        assert.ok(Math.abs(restored.width - before.width) < 2 && Math.abs(restored.height - before.height) < 2, 'Shrinking restores the original size without a release jump')
      }
      // West resizing respects both size limits while keeping the right edge fixed.
      const westPanel = widget('关系图谱')
      const westHandle = westPanel.locator('..').locator('.react-resizable-handle-w')
      await westHandle.scrollIntoViewIfNeeded()
      const westBefore = await westPanel.boundingBox(), westEdge = await westHandle.boundingBox()
      const westX = westEdge.x + westEdge.width / 2, westY = westEdge.y + westEdge.height / 2
      await page.mouse.move(westX, westY); await page.mouse.down()
      await page.mouse.move(westX + 4 * unit, westY, { steps: 14 })
      await page.mouse.up()
      const minimum = await westPanel.boundingBox()
      assert.ok(Math.abs(minimum.width - (4 * unit - 16)) < 2, 'West shrinking stops at the chart minimum width')
      assert.ok(Math.abs(minimum.x + minimum.width - westBefore.x - westBefore.width) < 2, 'Minimum width keeps the right edge fixed')
      const minimumEdge = await westHandle.boundingBox()
      await page.mouse.move(minimumEdge.x + minimumEdge.width / 2, westY); await page.mouse.down()
      await page.mouse.move(minimumEdge.x + minimumEdge.width / 2 - 20 * unit, westY, { steps: 14 })
      const maximum = await westPanel.boundingBox(), grid = await page.locator('.board-grid-container').boundingBox()
      assert.ok(Math.abs(maximum.x - grid.x) < 2 && Math.abs(maximum.width - grid.width) < 2, 'West expansion stops at the container boundary')
      await page.mouse.move(minimumEdge.x + minimumEdge.width / 2 - 2 * unit, westY, { steps: 14 }); await page.mouse.up()
      assert.ok(Math.abs((await westPanel.boundingBox()).x - westBefore.x) < 2, 'West resize restores the initial left position across gestures')
      // Releasing a growth, then shrinking in another gesture restores neighbors.
      const panel = widget('状态分布'), graph = widget('关系图谱')
      const resize = async delta => {
        const handle = panel.locator('..').locator('.react-resizable-handle-e')
        await handle.scrollIntoViewIfNeeded()
        const edge = await handle.boundingBox()
        await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2); await page.mouse.down()
        await page.mouse.move(edge.x + edge.width / 2 + delta, edge.y + edge.height / 2, { steps: 14 }); await page.mouse.up()
      }
      await panel.scrollIntoViewIfNeeded()
      const originalGraphY = await graph.evaluate(el => el.getBoundingClientRect().top + document.querySelector('.analytics-main').scrollTop)
      await resize(.75 * unit)
      await resize(-.75 * unit)
      await page.waitForFunction(top => Math.abs(document.querySelector('article[aria-label="关系图谱"]').getBoundingClientRect().top + document.querySelector('.analytics-main').scrollTop - top) < 2, originalGraphY)
      await resize(.75 * unit)
      await westHandle.scrollIntoViewIfNeeded()
      const persistEdge = await westHandle.boundingBox()
      await page.mouse.move(persistEdge.x + persistEdge.width / 2, persistEdge.y + persistEdge.height / 2); await page.mouse.down()
      await page.mouse.move(persistEdge.x + persistEdge.width / 2 + .75 * unit, persistEdge.y + persistEdge.height / 2, { steps: 14 }); await page.mouse.up()
      await save(); await page.reload(); await waitTotal(20); await chartsFit()
      const persisted = (await read()).config.widgets
      assert.equal(persisted.find(w => w.type === 'distribution').layout.w, 6.75)
      assert.ok(persisted.find(w => w.type === 'graph').layout.y > 4)
      assert.equal(persisted.find(w => w.type === 'graph').layout.x, 6.75, 'West-resized left position persists')
      assert.equal(persisted.find(w => w.type === 'graph').layout.w, 5.25, 'West-resized width persists')
      for (const width of [820, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.waitForFunction(width => width < 1100 ? !!document.querySelector('.board-narrow-grid') : !!document.querySelector('.board-grid-container .react-grid-layout'), width)
        await chartsFit()
        assert.deepEqual((await read()).config.widgets, persisted, 'Responsive browsing preserves resized geometry')
      }
      console.log('[analytics-resize] Passed metric/chart west/east/south/southeast resizing, limits, live yield/restoration, separate gestures, save/reload and responsive geometry')
      return
    }
    for (const name of ['状态分布', '关系图谱']) {
      const panel = widget(name)
      const before = await panel.boundingBox()
      const handle = panel.locator('..').locator('.react-resizable-handle-e')
      await handle.scrollIntoViewIfNeeded()
      const edge = await handle.boundingBox()
      await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2)
      await page.mouse.down()
      await page.mouse.move(edge.x + edge.width / 2 - before.width / 4, edge.y + edge.height / 2, { steps: 14 })
      await page.mouse.up()
      assert.ok((await panel.boundingBox()).width < before.width - 60, `${name} shrinks below its half-row default`)
    }
    await save(); await page.reload(); await waitTotal(20); await chartsFit()
    assert.ok((await read()).config.widgets.filter(w => w.type === 'distribution' || w.type === 'graph').every(w => w.layout.w < 6 && w.layout.w >= 4), 'Both reduced widths persist after reload')
    await page.getByRole('button', { name: '编辑看板', exact: true }).click()
    // A chart can push another chart by its full height, and moving away restores it.
    const graphHandle = widget('关系图谱').getByRole('button', { name: '拖动关系图谱', exact: true })
    await graphHandle.scrollIntoViewIfNeeded()
    const graphStart = await graphHandle.boundingBox()
    const neighborStart = await widget('状态分布').boundingBox()
    const dragGrid = await page.locator('.board-grid-container').boundingBox()
    const dragUnit = (dragGrid.width + 16) / 12
    await page.mouse.move(graphStart.x + 8, graphStart.y + 8); await page.mouse.down()
    await page.mouse.move(graphStart.x + 8 - 4.5 * dragUnit, graphStart.y + 8, { steps: 16 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.ok(Math.abs((await widget('状态分布').boundingBox()).y - neighborStart.y) < 2, 'Chart horizontal overlap below three quarters does not displace')
    await page.mouse.move(graphStart.x + 8 - 5.25 * dragUnit, graphStart.y + 8, { steps: 18 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await waitForTop('状态分布', neighborStart.y, 200)
    assert.ok((await widget('状态分布').boundingBox()).y > neighborStart.y + 200, 'A chart displaces its chart neighbor during dragging')
    await page.mouse.move(graphStart.x + 8 - 5.25 * dragUnit, graphStart.y + 128, { steps: 8 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await waitForTop('状态分布', neighborStart.y)
    assert.ok(Math.abs((await widget('状态分布').boundingBox()).y - neighborStart.y) < 2, 'Chart vertical overlap below three quarters does not displace')
    await page.mouse.move(graphStart.x + 8 - 5.25 * dragUnit, graphStart.y + 88, { steps: 8 })
    await waitForTop('状态分布', neighborStart.y, 200)
    await screenshot('analytics-chart-displacement')
    await page.mouse.move(graphStart.x + 8, graphStart.y + 8, { steps: 18 }); await page.mouse.up()
    await waitForTop('状态分布', neighborStart.y)
    assert.ok(Math.abs((await widget('状态分布').boundingBox()).y - neighborStart.y) < 2, 'The chart neighbor restores after moving away')
    const metricHandle = total.getByRole('button', { name: '拖动总投递数', exact: true })
    await metricHandle.scrollIntoViewIfNeeded()
    const metricStart = await metricHandle.boundingBox()
    const metricNeighbor = await widget('面试中').boundingBox()
    await page.mouse.move(metricStart.x + 8, metricStart.y + 8); await page.mouse.down()
    await page.mouse.move(metricStart.x + 8 + 1.5 * dragUnit, metricStart.y + 8, { steps: 12 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.ok(Math.abs((await widget('面试中').boundingBox()).y - metricNeighbor.y) < 2, 'Half-width overlap no longer displaces a metric')
    await page.mouse.move(metricStart.x + 8 + 2.25 * dragUnit, metricStart.y + 8, { steps: 8 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await waitForTop('面试中', metricNeighbor.y, 100)
    assert.ok((await widget('面试中').boundingBox()).y > metricNeighbor.y + 100, 'Three-quarter overlap displaces a metric')
    await page.mouse.move(metricStart.x + 8, metricStart.y + 8, { steps: 12 }); await page.mouse.up()
    await waitForTop('面试中', metricNeighbor.y)
    const verticalStart = await metricHandle.boundingBox()
    const chartBelow = await widget('状态分布').boundingBox()
    await page.mouse.move(verticalStart.x + 8, verticalStart.y + 8); await page.mouse.down()
    await page.mouse.move(verticalStart.x + 8, verticalStart.y + 88, { steps: 8 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.ok(Math.abs((await widget('状态分布').boundingBox()).y - chartBelow.y) < 2, 'Half-height metric overlap does not displace')
    await page.mouse.move(verticalStart.x + 8, verticalStart.y + 128, { steps: 8 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await waitForTop('状态分布', chartBelow.y, 100)
    assert.ok((await widget('状态分布').boundingBox()).y > chartBelow.y + 100, 'Three-quarter-height metric overlap displaces')
    await page.mouse.move(verticalStart.x + 8, verticalStart.y + 8, { steps: 12 }); await page.mouse.up()
    await page.getByRole('button', { name: '添加模块', exact: true }).click()
    const library = page.getByRole('dialog', { name: '添加模块', exact: true })
    assert.equal(await library.getByRole('button', { name: /^添加/ }).count(), 7)
    await screenshot('analytics-library-metrics')
    await library.getByRole('tab', { name: /数值型/ }).focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await library.getByRole('tab', { name: /图表型/ }).getAttribute('aria-selected'), 'true')
    assert.deepEqual(await library.getByRole('button', { name: /^添加/ }).evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label'))), ['添加状态分布', '添加关系图谱', '添加状态占比'])
    await screenshot('analytics-library-charts')
    await page.keyboard.press('Escape')
    for (const name of ['待投递', '已投公司', '未关联简历', '状态占比']) await add(name)
    assert.equal(await widget('待投递').locator('.analytics-stat-value').innerText(), '5')
    assert.equal(await widget('已投公司').locator('.analytics-stat-value').innerText(), '20')
    assert.equal(await widget('未关联简历').locator('.analytics-stat-value').innerText(), '2')
    assert.ok((await widget('未关联简历').locator('.analytics-stat-note').innerText()).includes('10%'))
    await save(); await page.reload(); await waitTotal(20); await chartsFit()
    assert.deepEqual((await read()).config.widgets.slice(-4).map(w => w.type), ['interested', 'companies', 'unbound', 'status'])
    await page.getByRole('combobox', { name: '筛选简历' }).click()
    await page.getByRole('option', { name: '未关联简历', exact: true }).click()
    await page.keyboard.press('Escape')
    await waitTotal(2)
    assert.equal(await widget('待投递').locator('.analytics-stat-value').innerText(), '1')
    assert.equal(await widget('已投公司').locator('.analytics-stat-value').innerText(), '2')
    await page.getByRole('combobox', { name: '筛选简历' }).click()
    await page.getByRole('option', { name: '全部简历', exact: true }).click()
    await page.keyboard.press('Escape')
    for (const width of [1440, 1100, 1099, 820, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForFunction(width => width < 1100 ? !!document.querySelector('.board-narrow-grid') : !!document.querySelector('.board-grid-container .react-grid-layout'), width)
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      await chartsFit(); await widget('状态占比').scrollIntoViewIfNeeded()
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Library modules fit the viewport')
      await screenshot(`analytics-status-share-${width}`)
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForFunction(() => !!document.querySelector('.board-grid-container .react-grid-layout'))
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await chartsFit(); await widget('状态占比').scrollIntoViewIfNeeded()
    await widget('状态占比').screenshot({ path: '.cache/batch-check/status-share-card.png' })
    await page.getByRole('combobox', { name: '当前批次' }).click()
    await page.getByRole('option', { name: '空面板验收', exact: true }).click()
    await waitTotal(0)
    assert.equal(await widget('状态占比').getByText('暂无岗位数据', { exact: true }).count(), 1)
    console.log('[analytics-library] Passed real tab keyboard navigation, curated catalog, metric counts, save/reload, resume and batch filters, empty state and responsive chart layouts')
    return
  }
  const assertDefaultPanels = async () => {
    const bounds = await page.waitForFunction(names => {
      const widgets = [...document.querySelectorAll('.board-widget')]
      if (widgets.length !== names.length) return false
      const panels = names.map(name => widgets.find(el => el.getAttribute('aria-label') === name))
      if (panels.some(el => !el || el.parentElement.getAnimations().some(animation => animation.playState === 'running'))) return false
      return panels.map(el => el.getBoundingClientRect().toJSON())
    }, ['状态分布', '关系图谱', '总投递数', '面试中', '测评中', '常用渠道'])
    const [left, right, ...cards] = await bounds.jsonValue()
    await bounds.dispose()
    assert.ok(cards.every(card => Math.abs(card.y - cards[0].y) < 2 && Math.abs(card.width - cards[0].width) < 2), 'Four equal-width metric cards share the first row')
    assert.ok(left.y > cards[0].y + cards[0].height && Math.abs(left.y - right.y) < 2 && Math.abs(left.width - right.width) < 2 && Math.abs(left.height - right.height) < 2 && right.x > left.x + left.width, 'Distribution and graph share an equal-sized second row')
  }
  await assertDefaultPanels()
  const assertGridFillsContainer = async () => {
    await page.waitForFunction(() => {
      const el = document.querySelector('.board-grid-container')
      if (!el) return false
      const right = Math.max(...[...el.querySelectorAll('.react-grid-item:not(.react-grid-placeholder)')].map(item => item.getBoundingClientRect().right))
      return Math.abs(right - el.getBoundingClientRect().right) < 2
    }, null, { timeout: 5000 })
    const sizes = await page.locator('.board-grid-container').evaluate(el => ({ container: el.getBoundingClientRect().width, grid: Math.max(...[...el.querySelectorAll('.react-grid-item:not(.react-grid-placeholder)')].map(item => item.getBoundingClientRect().right)) - el.getBoundingClientRect().left }))
    assert.ok(Math.abs(sizes.container - sizes.grid) < 2, `Grid fills available width: ${JSON.stringify(sizes)}`)
  }
  await assertGridFillsContainer()
  assert.equal(await page.getByRole('navigation', { name: '面板视图' }).count(), 0)
  for (const key of ['view', 'sort', 'order', 'page']) assert.equal(new URL(page.url()).searchParams.has(key), false)
  await chartsFit(); await page.waitForTimeout(500); await screenshot('analytics-default')
  assert.ok(await page.locator('.board-control-panel').evaluate(el => {
    const style = getComputedStyle(el)
    const title = el.querySelector('h1').getBoundingClientRect()
    const filter = el.querySelector('[aria-label="时间范围"]').getBoundingClientRect()
    const actions = el.querySelector('.board-actions').getBoundingClientRect()
    return style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.borderTopWidth === '0px'
      && Math.abs(title.y + title.height / 2 - filter.y - filter.height / 2) < 3
      && Math.abs(actions.y + actions.height / 2 - filter.y - filter.height / 2) < 3
  }), 'Frameless toolbar keeps the title, filters and edit action on one row')
  assert.ok(await page.locator('.board-global-filters').evaluate(el => {
    const controls = [...el.querySelectorAll('[role=combobox]')].map(button => {
      const style = getComputedStyle(button)
      const icon = button.querySelector('svg').getBoundingClientRect()
      const text = button.querySelector('span > span:last-child').getBoundingClientRect()
      const arrow = button.nextElementSibling.getBoundingClientRect()
      return { height: button.getBoundingClientRect().height, left: style.paddingLeft, right: style.paddingRight, icon: icon.width, iconGap: text.left - icon.right, arrowGap: arrow.left - text.right }
    })
    return JSON.stringify(controls[0]) === JSON.stringify(controls[1]) && controls[0].arrowGap <= 12
  }), 'Time and resume controls use identical compact internal spacing')
  const timeFilter = page.getByRole('combobox', { name: '时间范围' })
  const assertFilterHighlight = async (name, active) => {
    // The label animates its color; wait for the final style, then assert it.
    await page.waitForFunction(({ name, active }) => {
      const control = document.querySelector(`[role="combobox"][aria-label="${name}"]`)
      const label = control?.querySelector('button > span > span:last-child')
      return label && getComputedStyle(label).color === (active ? 'rgb(146, 107, 72)' : 'rgb(40, 63, 96)')
    }, { name, active })
    const style = await page.getByRole('combobox', { name }).evaluate(el => ({
      color: getComputedStyle(el.querySelector('button > span > span:last-child')).color,
      marker: getComputedStyle(el.querySelector('button > span > span:first-child'), '::after').content,
      weight: getComputedStyle(el).fontWeight,
    }))
    assert.equal(style.color, active ? 'rgb(146, 107, 72)' : 'rgb(40, 63, 96)', `${name}: the visible label reflects the filter state`)
    assert.equal(style.marker, active ? '""' : 'none', `${name}: only specific filters show a status dot`)
    assert.equal(style.weight, '400', `${name}: filters keep regular font weight`)
  }
  await assertFilterHighlight('时间范围', false)
  await assertFilterHighlight('筛选简历', false)
  await assertFilterHighlight('当前批次', true)
  await timeFilter.click()
  await screenshot('analytics-time-filter')
  await page.keyboard.press('Escape')
  assert.equal(await timeFilter.getAttribute('aria-expanded'), 'false')
  await timeFilter.click()
  await page.getByRole('option', { name: '自定义日期', exact: true }).click()
  const datePanel = page.getByRole('dialog', { name: '自定义日期' })
  await datePanel.getByRole('button', { name: '开始日期', exact: true }).click()
  await datePanel.getByRole('dialog', { name: '选择开始日期' }).getByRole('button', { name: '今天', exact: true }).click()
  await datePanel.getByRole('button', { name: '结束日期', exact: true }).click()
  await datePanel.getByRole('dialog', { name: '选择结束日期' }).getByRole('button', { name: '今天', exact: true }).click()
  assert.equal(new URL(page.url()).searchParams.has('start'), false, 'Date edits stay staged until applied')
  await datePanel.getByRole('button', { name: '应用日期' }).click()
  await waitTotal(19)
  await assertFilterHighlight('时间范围', true)
  await page.getByRole('button', { name: '重置筛选' }).click()
  assert.equal(new URL(page.url()).searchParams.has('batch'), false, 'Reset clears batch as well as time and resumes')
  await assertFilterHighlight('当前批次', false)
  await assertFilterHighlight('时间范围', false)
  await page.getByRole('combobox', { name: '当前批次' }).click()
  await page.getByRole('option', { name: '面板验收', exact: true }).click()
  await waitTotal(20)
  assert.equal(await page.getByRole('button', { name: '筛选条件' }).count(), 0)
  await page.getByRole('combobox', { name: '筛选简历' }).click(); await page.getByRole('option', { name: '未关联简历', exact: true }).click()
  await waitTotal(2)
  await assertFilterHighlight('筛选简历', true)
  await page.getByRole('option', { name: '面板产品简历', exact: true }).click()
  await waitTotal(20)
  assert.deepEqual(new URL(page.url()).searchParams.getAll('resume'), ['unbound', resume])
  await page.reload(); await waitTotal(20)
  assert.ok((await page.getByRole('combobox', { name: '筛选简历' }).innerText()).includes('已选 2 份简历'))
  await screenshot('analytics-active-filters')
  await page.getByRole('combobox', { name: '筛选简历' }).click(); await page.getByRole('option', { name: '全部简历', exact: true }).click()
  await page.keyboard.press('Escape')
  await assertFilterHighlight('筛选简历', false)
  await page.getByRole('combobox', { name: '时间范围' }).click(); await page.getByRole('option', { name: '近 30 天', exact: true }).click(); await waitTotal(19)
  await page.reload(); await waitTotal(19)
  // Keep exercising resize/drag compatibility with the previously saved layout.
  const legacyConfig = { version: 1, widgets: ['total', 'interviewing', 'assessing', 'topChannel', 'distribution'].map((type, index) => ({
    id: `default-${type}`, type, title: ['总投递数', '面试中', '测评中', '常用渠道', '状态分布'][index],
    layout: index < 4 ? { x: index * 3, y: 0, w: 3, h: 4 } : { x: 0, y: 4, w: 12, h: 11 },
  })) }
  await db.query('insert into dashboard_configs(user_id,config) values($1,$2)', [user, JSON.stringify(legacyConfig)])
  await page.reload(); await waitTotal(19)
  await page.getByRole('button', { name: '编辑看板', exact: true }).click()
  await page.getByRole('button', { name: '添加模块', exact: true }).click()
  const library = page.getByRole('dialog', { name: '添加模块', exact: true })
  assert.equal(await library.getByRole('tab', { name: /数值型/ }).getAttribute('aria-selected'), 'true')
  assert.equal(await library.locator('.library-preview').count(), 7)
  assert.equal(await library.locator('.library-preview-stat').count(), 7)
  assert.equal(await library.locator('.library-preview > svg').count(), 0)
  await screenshot('analytics-library-metrics')
  await library.getByRole('tab', { name: /数值型/ }).focus()
  await page.keyboard.press('ArrowRight')
  assert.equal(await library.getByRole('tab', { name: /图表型/ }).getAttribute('aria-selected'), 'true')
  assert.ok(await library.getByRole('tab', { name: /图表型/ }).evaluate(el => el === document.activeElement))
  assert.equal(await library.locator('.library-preview-stat').count(), 0)
  assert.equal(await library.locator('.library-preview > svg').count(), 3)
  await screenshot('analytics-library-charts')
  for (const width of [1440, 1100]) {
    await page.setViewportSize({ width, height: 900 })
    assert.ok(await library.evaluate(el => el.scrollWidth <= el.clientWidth), 'Library previews fit without horizontal overflow')
    await screenshot(`analytics-module-library-${width}`)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.keyboard.press('Escape')
  await library.waitFor({ state: 'hidden' })
  assert.equal(await page.getByRole('button', { name: /调整.*布局/ }).count(), 0)
  assert.equal(await page.getByLabel('模块宽度', { exact: true }).count(), 0)
  assert.equal(await page.getByLabel('模块高度', { exact: true }).count(), 0)
  for (const type of ['关系图谱', '关系图谱', '状态占比', '总投递数']) await add(type)
  const extra = page.getByRole('article').last()
  await extra.getByRole('textbox', { name: '模块标题' }).fill('近期投递')
  assert.equal(await extra.locator('.analytics-stat-value').innerText(), '19')
  assert.ok(await extra.getByRole('textbox', { name: '模块标题' }).evaluate(el => getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(el).borderTopWidth === '0px'), 'Editable titles have no rounded input frame')
  await chartsFit()

  // Real resize and drag, then assert their durable effect in the database.
  const distribution = widget('状态分布')
  const initialSize = await distribution.boundingBox()
  const resize = distribution.locator('..').locator('.react-resizable-handle-se')
  await resize.scrollIntoViewIfNeeded()
  const resizeBox = await resize.boundingBox()
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2)
  const resizeTarget = { x: resizeBox.x + resizeBox.width / 2 - initialSize.width * 0.3, y: resizeBox.y + resizeBox.height / 2 + 240 }
  await page.mouse.down()
  await page.mouse.move(resizeBox.x + resizeBox.width / 2 - 12, resizeBox.y + resizeBox.height / 2 + 7, { steps: 3 })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const smallResize = await distribution.boundingBox()
  assert.ok(Math.abs(smallResize.width - initialSize.width + 12) < 3 && Math.abs(smallResize.height - initialSize.height - 7) < 3, 'Small pointer movements within one snap band must still resize continuously')
  await page.mouse.move(resizeTarget.x, resizeTarget.y, { steps: 15 })
  const resizing = distribution.locator('..')
  assert.ok(await resizing.evaluate(el => el.classList.contains('resizing') && getComputedStyle(el).transitionDuration === '0s'), 'Resizing follows the pointer without transition lag')
  assert.ok(await distribution.evaluate(el => Number(getComputedStyle(el).opacity) < 1 && getComputedStyle(el).boxShadow !== 'none'), 'Active module is translucent and elevated')
  assert.equal(await page.locator('.board-snap-guides').count(), 0, 'No page-spanning guide lines during resizing')
  const floatingSize = await resizing.boundingBox()
  const expectedWidth = initialSize.width + resizeTarget.x - (resizeBox.x + resizeBox.width / 2)
  assert.ok(Math.abs(floatingSize.width - expectedWidth) < 3, 'Live resize follows the pointer between common sizes')
  await screenshot('analytics-resize-floating')
  await page.mouse.up()
  const handle = total.getByRole('button', { name: '拖动总投递数', exact: true })
  await handle.scrollIntoViewIfNeeded()
  const box = await handle.boundingBox()
  await page.mouse.move(box.x + 7, box.y + 8); await page.mouse.down()
  const initialDrag = await total.boundingBox()
  await page.mouse.move(box.x + 27, box.y + 18, { steps: 4 })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const smallDrag = await total.boundingBox()
  assert.ok(Math.abs(smallDrag.x - initialDrag.x - 20) < 3 && Math.abs(smallDrag.y - initialDrag.y - 10) < 3, 'Small pointer movements within one snap band must still drag continuously')
  await page.mouse.move(box.x + 350, box.y + 180, { steps: 18 })
  assert.ok(await total.evaluate(el => Number(getComputedStyle(el).opacity) < 1 && getComputedStyle(el).boxShadow !== 'none'), 'Dragged module is translucent and elevated')
  assert.equal(await page.locator('.board-snap-guides').count(), 0, 'No page-spanning guide lines during dragging')
  await screenshot('analytics-drag-floating')
  await page.mouse.up()
  await save()
  const savedToast = page.getByText('看板已保存', { exact: true })
  await savedToast.waitFor()
  assert.ok(await savedToast.evaluate(el => el.parentElement.classList.contains('animate-slide-in') && el.parentElement.querySelector('.text-emerald-500')), 'Saved board uses the shared success toast')
  await screenshot('analytics-save-toast')
  let saved = await read()
  assert.deepEqual(
    saved.config.widgets.map(w => w.type),
    [...legacyConfig.widgets.map(w => w.type), 'graph', 'graph', 'status', 'total'],
    'Saving retains the seeded modules and all four additions in order',
  )
  const dist = saved.config.widgets.find(w => w.type === 'distribution')
  assert.equal(dist.layout.w, 8.25, 'Resize persists the nearest sixteenth-width stop')
  assert.equal(dist.layout.h, 14, 'Vertical resize keeps the standard height presets')
  const moved = saved.config.widgets.find(w => w.id === 'default-total')
  assert.ok(moved.layout.x !== 0 || moved.layout.y !== 0, 'Pointer drag changes saved grid position')
  assert.equal(moved.layout.x % 0.75, 0, 'Dragged module aligns to a quarter-card width stop')
  for (const a of saved.config.widgets) for (const b of saved.config.widgets) if (a.id !== b.id) assert.ok(a.layout.x + a.layout.w <= b.layout.x || b.layout.x + b.layout.w <= a.layout.x || a.layout.y + a.layout.h <= b.layout.y || b.layout.y + b.layout.h <= a.layout.y, 'Saved modules never overlap')
  await page.reload(); await widget('近期投递').waitFor(); await chartsFit()
  const restoredSize = await distribution.boundingBox()
  assert.equal(await widget('近期投递').locator('.analytics-stat-value').innerText(), '19')

  // Near a conventional size, the same pointer interaction still snaps on drop.
  await page.getByRole('button', { name: '编辑看板', exact: true }).click()
  await resize.scrollIntoViewIfNeeded()
  const snapHandle = await resize.boundingBox()
  const gridBox = await page.locator('.board-grid-container').boundingBox()
  const halfWidth = (gridBox.width + 16) / 2 - 16
  await page.mouse.move(snapHandle.x + snapHandle.width / 2, snapHandle.y + snapHandle.height / 2)
  await page.mouse.down()
  await page.mouse.move(snapHandle.x + snapHandle.width / 2 + halfWidth - restoredSize.width + 7, snapHandle.y + snapHandle.height / 2 + (14 * 40 - 16) - restoredSize.height - 7, { steps: 15 })
  await page.mouse.up()
  await save()
  saved = await read()
  const snapped = saved.config.widgets.find(w => w.type === 'distribution')
  assert.equal(snapped.layout.w, 6, 'Nearby half width still snaps')
  assert.equal(snapped.layout.h, 14, 'Nearby standard height still snaps')

  await page.getByRole('button', { name: '编辑看板', exact: true }).click()
  const east = distribution.locator('..').locator('.react-resizable-handle-e')
  await east.scrollIntoViewIfNeeded()
  const eastBox = await east.boundingBox()
  const beforeEast = await distribution.boundingBox()
  await page.mouse.move(eastBox.x + eastBox.width / 2, eastBox.y + eastBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(eastBox.x + eastBox.width / 2 + 137, eastBox.y + eastBox.height / 2, { steps: 12 })
  await page.mouse.up()
  await save()
  saved = await read()
  const horizontal = saved.config.widgets.find(w => w.type === 'distribution')
  const expectedHorizontal = Math.round((6 + 137 / ((gridBox.width + 16) / 12)) / 0.75) * 0.75
  assert.equal(horizontal.layout.w, expectedHorizontal, 'Right edge lands on the nearest quarter-card width stop')
  assert.equal(horizontal.layout.h, 14, 'Horizontal resizing preserves height')
  await page.reload(); await widget('近期投递').waitFor(); await chartsFit()
  const afterEast = await distribution.boundingBox()
  assert.ok(Math.abs(afterEast.width - beforeEast.width - (expectedHorizontal - 6) * (gridBox.width + 16) / 12) < 2 && afterEast.height === beforeEast.height, 'Horizontal snap width survives save and reload')

  // Chart interactions must not mutate the saved layout.
  const graph = widget('关系图谱').first()
  await graph.getByRole('button', { name: '适应视图', exact: true }).click()
  const canvas = await graph.locator('canvas').boundingBox()
  await page.mouse.move(canvas.x + 100, canvas.y + 120); await page.mouse.down()
  await page.mouse.move(canvas.x + 160, canvas.y + 155, { steps: 8 }); await page.mouse.up()
  assert.deepEqual((await read()).config, saved.config)

  await page.getByRole('button', { name: '编辑看板', exact: true }).click()
  await total.getByRole('textbox', { name: '模块标题' }).fill('离开草稿')
  const leaveForHome = async () => {
    await page.locator('.analytics-brand').hover()
    await page.getByTitle('返回首页', { exact: true }).click()
  }
  await leaveForHome()
  await page.getByRole('dialog', { name: '离开看板' }).getByRole('button', { name: '继续编辑' }).click()
  assert.equal(await widget('离开草稿').count(), 1)
  await leaveForHome()
  await page.getByRole('dialog', { name: '离开看板' }).getByRole('button', { name: '放弃并离开' }).click()
  await page.waitForURL(new URL('/', origin).href)
  await page.goto(`${origin}/analytics?batch=${batch}`)
  await page.getByRole('button', { name: '编辑看板', exact: true }).waitFor()

  // Save failure retains the draft; optimistic revision conflict refuses overwrite.
  await page.getByRole('button', { name: '编辑看板', exact: true }).click()
  await total.getByRole('textbox', { name: '模块标题' }).fill('冲突草稿')
  await db.query('update dashboard_configs set revision=revision+1 where user_id=$1', [user])
  await page.getByRole('button', { name: '保存看板', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '其他窗口' }).waitFor()
  assert.equal(await widget('冲突草稿').count(), 1)
  await page.getByRole('button', { name: '取消编辑', exact: true }).click()
  await widget('冲突草稿').waitFor({ state: 'hidden' })
  assert.equal(await widget('冲突草稿').count(), 0)
  await page.reload(); await page.getByRole('button', { name: '编辑看板', exact: true }).waitFor()

  // Scope changes retain config; invalid selected resumes produce no misleading metrics.
  await page.goto(`${origin}/analytics?batch=${emptyBatch}&resume=${resume}`)
  await total.locator('.widget-warning').filter({ hasText: '所选简历已删除或不在当前批次，请在顶部重新选择' }).waitFor()
  assert.equal(await total.locator('.analytics-stat-value').count(), 0)
  assert.deepEqual((await read()).config, saved.config)

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 600 }, { width: 1100, height: 900 }, { width: 1099, height: 900 }, { width: 820, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(viewport)
    await page.goto(`${origin}/analytics?batch=${batch}`)
    await widget('近期投递').waitFor(); await chartsFit()
    if (viewport.width >= 1100) await assertGridFillsContainer()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow')
    assert.equal(await page.getByRole('button', { name: '编辑看板', exact: true }).count(), viewport.width >= 1100 ? 1 : 0)
    await timeFilter.click()
    await page.getByRole('option', { name: '自定义日期', exact: true }).click()
    const dateBounds = await datePanel.boundingBox()
    assert.ok(dateBounds.x >= 0 && dateBounds.x + dateBounds.width <= viewport.width, 'Date popover stays within the viewport')
    await page.keyboard.press('Escape')
    assert.ok(await timeFilter.evaluate(el => el === document.activeElement), 'Escape returns focus to the time control')
    await page.locator('.analytics-main').evaluate(el => { el.scrollTop = el.scrollHeight })
    await screenshot(`analytics-custom-${viewport.width}x${viewport.height}`)
    assert.deepEqual((await read()).config, saved.config, 'Responsive display must not persist a mobile layout')
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.reload(); await page.getByRole('button', { name: '编辑看板', exact: true }).click()
  await page.getByRole('button', { name: '恢复默认布局', exact: true }).click()
  await assertDefaultPanels()
  await page.getByRole('button', { name: '取消编辑', exact: true }).click()
  await widget('近期投递').waitFor()
  assert.equal(await widget('近期投递').count(), 1)
  // A partially occupied first row must not pull a module out of row two.
  const rowConfig = { version: 1, widgets: ['total', 'interviewing', 'assessing', 'topChannel', 'distribution'].map((type, index) => ({
    ...saved.config.widgets.find(w => w.id === `default-${type}`),
    layout: [
      { x: 0, y: 0, w: 3, h: 4 }, { x: 3, y: 0, w: 3, h: 4 },
      { x: 0, y: 4, w: 4.5, h: 4 }, { x: 6, y: 0, w: 3, h: 4 },
      { x: 0, y: 8, w: 12, h: 11 },
    ][index],
  })) }
  await db.query('update dashboard_configs set config=$2,revision=revision+1 where user_id=$1', [user, JSON.stringify(rowConfig)])
  await page.reload()
  await page.getByRole('button', { name: '编辑看板', exact: true }).click()
  const rowHandle = widget('常用渠道').getByRole('button', { name: '拖动常用渠道', exact: true })
  await rowHandle.scrollIntoViewIfNeeded()
  const rowBox = await rowHandle.boundingBox()
  await page.mouse.move(rowBox.x + 8, rowBox.y + 8); await page.mouse.down()
  const rowGrid = await page.locator('.board-grid-container').boundingBox()
  await page.mouse.move(rowBox.x + 8 - 1.5 * (rowGrid.width + 16) / 12, rowBox.y + 168, { steps: 16 }); await page.mouse.up()
  await save()
  assert.equal((await read()).config.widgets.find(w => w.type === 'topChannel').layout.y, 4, 'Occupied second row accepts a module despite space in row one')
  assert.equal((await read()).config.widgets.find(w => w.type === 'topChannel').layout.x, 4.5, 'A module can sit beside a fractional-width neighbor between quarter-row rails')
  await page.reload()
  await page.getByRole('button', { name: '编辑看板', exact: true }).click()
  const restoringHandle = total.getByRole('button', { name: '拖动总投递数', exact: true })
  await restoringHandle.scrollIntoViewIfNeeded()
  const restoringBox = await restoringHandle.boundingBox()
  const originalNeighbor = await widget('测评中').boundingBox()
  const unit = (rowGrid.width + 16) / 12
  await page.mouse.move(restoringBox.x + 8, restoringBox.y + 8); await page.mouse.down()
  await page.mouse.move(restoringBox.x + 8, restoringBox.y + 168, { steps: 12 })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.ok((await widget('测评中').boundingBox()).y > originalNeighbor.y + 20, 'A temporarily displaces the manually lowered B downward')
  await page.mouse.up()
  // The displacement remains temporary even if A was dropped, then picked up.
  const squeezedHandle = await restoringHandle.boundingBox()
  await page.mouse.move(squeezedHandle.x + 8, squeezedHandle.y + 8); await page.mouse.down()
  const belowCard = await widget('测评中').boundingBox()
  const belowChart = await widget('状态分布').boundingBox()
  assert.ok(belowCard.y + belowCard.height <= belowChart.y, 'B remains before the large chart after another displacement')
  await page.mouse.move(squeezedHandle.x + 8 + 9 * unit, squeezedHandle.y + 8 - 160, { steps: 18 })
  await page.mouse.up(); await save()
  assert.equal((await read()).config.widgets.find(w => w.type === 'assessing').layout.y, 4, 'The manually lowered B returns upward after A moves away')
  assert.equal((await read()).config.widgets.find(w => w.type === 'distribution').layout.y, 8, 'The chart also restores its place below B')
  await page.getByRole('button', { name: '编辑看板', exact: true }).click()
  await total.getByRole('button', { name: '移除总投递数', exact: true }).click()
  await widget('面试中').getByRole('button', { name: '移除面试中', exact: true }).click()
  await save()
  assert.ok((await read()).config.widgets.filter(w => w.type === 'assessing' || w.type === 'topChannel').every(w => w.layout.y === 0), 'Removing the entire first row pulls the next row upward')
  await page.getByRole('button', { name: '编辑看板', exact: true }).click()
  while (await page.getByRole('button', { name: /^移除/ }).count()) await page.getByRole('button', { name: /^移除/ }).first().click()
  await save(); await page.reload()
  await page.getByRole('heading', { name: '看板还没有模块' }).waitFor()
  assert.deepEqual((await read()).config.widgets, [])

  // Curated library: three additional metrics and a refined status share ring.
  await page.getByRole('button', { name: '编辑看板', exact: true }).click()
  for (const name of ['待投递', '已投公司', '未关联简历', '状态占比']) await add(name)
  await chartsFit()
  assert.equal(await widget('待投递').locator('.analytics-stat-value').innerText(), '5')
  assert.equal(await widget('已投公司').locator('.analytics-stat-value').innerText(), '20')
  assert.equal(await widget('未关联简历').locator('.analytics-stat-value').innerText(), '2')
  assert.ok((await widget('未关联简历').locator('.analytics-stat-note').innerText()).includes('10%'))
  await save()
  assert.deepEqual((await read()).config.widgets.map(w => w.type), ['interested', 'companies', 'unbound', 'status'])
  await page.reload(); await widget('状态占比').waitFor(); await chartsFit()
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await chartsFit()
    await widget('状态占比').scrollIntoViewIfNeeded()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Refined share chart fits narrow screens')
    await screenshot(`analytics-status-share-${width}`)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('combobox', { name: '筛选简历' }).click()
  await page.getByRole('option', { name: '未关联简历', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('article[aria-label="已投公司"] .analytics-stat-value')?.textContent === '2')
  assert.equal(await widget('已投公司').locator('.analytics-stat-value').innerText(), '2')
  assert.equal(await widget('未关联简历').locator('.analytics-stat-value').innerText(), '2')
  await page.getByRole('combobox', { name: '当前批次' }).click()
  await page.getByRole('option', { name: '空面板验收', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('article[aria-label="已投公司"] .analytics-stat-value')?.textContent === '0')
  assert.equal(await page.getByText('暂无岗位数据', { exact: true }).count(), 1)
  await screenshot('analytics-new-empty')
  await page.getByRole('button', { name: '编辑看板', exact: true }).click()
  while (await page.getByRole('button', { name: /^移除/ }).count()) await page.getByRole('button', { name: /^移除/ }).first().click()
  await save()
  const configUrl = `${new URL(supabaseUrl).origin}/rest/v1/dashboard_configs*`
  const fail = route => route.fulfill({ status: 404, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ code: 'PGRST205', message: 'missing table' }) })
  await page.route(configUrl, fail); await page.reload()
  await page.getByRole('alert').filter({ hasText: '数据库迁移' }).waitFor()
  assert.equal(await page.getByRole('button', { name: '编辑看板', exact: true }).count(), 0)
  await page.unroute(configUrl, fail)
  await page.getByRole('button', { name: '重新加载配置', exact: true }).click()
  await page.getByRole('heading', { name: '看板还没有模块' }).waitFor()
  console.log('[analytics] Passed full-width grid drag/resize, duplicate charts, global filters, cloud persistence, conflicts, responsive views, empty and retry checks')
}
