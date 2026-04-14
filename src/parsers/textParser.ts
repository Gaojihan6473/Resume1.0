export async function extractTextFromTxt(file: File): Promise<string> {
  const text = await file.text()
  return text
}
