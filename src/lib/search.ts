export interface SearchResult {
  type: 'post' | 'tag' | 'author'
  title: string
  description?: string
  url: string
  icon?: string
}
