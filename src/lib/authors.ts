import { getAuthor, getAuthors, type Author } from './content'

export function parseAuthors(authorSlugs: string[]): Author[] {
  return authorSlugs.map((slug) => {
    const author = getAuthor(slug)
    if (!author) {
      // Return a fallback author if not found
      return {
        slug,
        name: slug,
        content: '',
      }
    }
    return author
  })
}

export function getAllAuthors(): Author[] {
  return getAuthors()
}
