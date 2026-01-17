import { getProjects } from '@/lib/content'

export const metadata = {
  title: 'Projects',
  description: 'All projects',
}

export default function ProjectsPage() {
  const projects = getProjects()

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 text-4xl font-bold">Projects</h1>
      <div className="grid gap-6 md:grid-cols-2">
        {projects.map((project) => (
          <a
            key={project.slug}
            href={project.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-lg border p-6 hover:border-primary"
          >
            <h2 className="mb-2 text-xl font-semibold group-hover:underline">
              {project.name}
            </h2>
            <p className="mb-4 text-muted-foreground">{project.description}</p>
            <div className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-secondary px-2 py-1 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Role: {project.role}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
