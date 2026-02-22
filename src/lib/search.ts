export interface SearchResult {
  type: 'post' | 'tag' | 'author' | 'settings' | 'tool'
  title: string
  description?: string
  url: string
  icon?: string
}
