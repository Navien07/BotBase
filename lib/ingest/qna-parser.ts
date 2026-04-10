// Q&A document parser
// Detects Q:/A: patterns and extracts FAQ pairs

export interface QnAPair {
  question: string
  answer: string
}

/**
 * Returns true if the text contains at least 3 Q:/A: pairs,
 * indicating this is a Q&A document that should go to faqs table.
 */
export function isQnADocument(text: string): boolean {
  const matches = text.match(/^\s*Q\s*:/gim)
  return (matches?.length ?? 0) >= 3
}

/**
 * Parse Q:/A: pairs from text.
 * Supports formats like:
 *   Q: What is X?
 *   A: X is ...
 *
 *   Q: How do I ...?
 *   A: You can ...
 */
export function parseQnA(text: string): QnAPair[] {
  const pairs: QnAPair[] = []

  // Split text into blocks starting with Q:
  // Using lookahead so the Q: prefix stays with each block
  const blocks = text.split(/(?=\bQ\s*:)/i).filter((b) => /^\s*Q\s*:/i.test(b))

  for (const block of blocks) {
    // Extract question: everything between Q: and A:
    const qMatch = block.match(/^\s*Q\s*:\s*([\s\S]*?)(?=\n\s*A\s*:)/i)
    // Extract answer: everything after A: until end of block
    const aMatch = block.match(/A\s*:\s*([\s\S]+?)(?=\n\s*Q\s*:|$)/i)

    if (qMatch && aMatch) {
      const question = qMatch[1].trim()
      const answer = aMatch[1].trim()
      if (question && answer) {
        pairs.push({ question, answer })
      }
    }
  }

  return pairs
}
