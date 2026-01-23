export interface SearchResult {
  type: 'post' | 'tag' | 'author' | 'settings'
  title: string
  description?: string
  url: string
  icon?: string
}
