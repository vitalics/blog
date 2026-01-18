"use client";

import {
  File as FileIcon,
  Folder as FolderIcon,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { createContext, useContext, ReactNode, useState } from "react";
import Image from "next/image";

interface FileTreeContextValue {
  level: number;
}

const FileTreeContext = createContext<FileTreeContextValue>({ level: 0 });

interface FileTreeProps {
  children: ReactNode;
  title?: string;
}

export function FileTree({ children, title }: FileTreeProps) {
  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border bg-card">
      {title && (
        <div className="border-b bg-muted/50 px-4 py-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FolderOpen className="h-4 w-4" />
            {title}
          </div>
        </div>
      )}
      <div className="overflow-x-auto p-4 font-mono text-sm">
        <FileTreeContext.Provider value={{ level: 0 }}>
          {children}
        </FileTreeContext.Provider>
      </div>
    </div>
  );
}

interface FolderProps {
  name: string;
  children?: ReactNode;
  defaultOpen?: boolean;
}

function Folder({ name, children, defaultOpen = true }: FolderProps) {
  const { level } = useContext(FileTreeContext);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <>
      <div
        className="flex items-start gap-1 py-0.5 cursor-pointer hover:bg-muted/50 rounded-sm transition-colors"
        style={{ marginLeft: `${level * 24}px` }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        {isOpen ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
        ) : (
          <FolderIcon className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
        )}
        <span className="select-none">{name}</span>
      </div>
      {isOpen && children && (
        <FileTreeContext.Provider value={{ level: level + 1 }}>
          {children}
        </FileTreeContext.Provider>
      )}
    </>
  );
}

interface FileProps {
  name: string;
  comment?: string;
}

function FileComponent({ name, comment }: FileProps) {
  const { level } = useContext(FileTreeContext);

  // Get file extension and match with known tags
  const extension = name.split(".").pop()?.toLowerCase();

  const getFileIcon = () => {
    switch (extension) {
      case "ts":
      case "tsx":
        return (
          <Image
            src="/tags/typescript.svg"
            alt="TypeScript"
            width={16}
            height={16}
            className="h-4 w-4 shrink-0"
          />
        );
      case "js":
      case "jsx":
        return (
          <Image
            src="/tags/javascript.svg"
            alt="JavaScript"
            width={16}
            height={16}
            className="h-4 w-4 shrink-0"
          />
        );
      case "json":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            shapeRendering="geometricPrecision"
            textRendering="geometricPrecision"
            imageRendering="optimizeQuality"
            fillRule="evenodd"
            clipRule="evenodd"
            viewBox="0 0 510 511.56"
            xlinkTitle="asd"
            className="h-4 w-4"
          >
            <path
              fillRule="nonzero"
              d="M122.91 0h201.68c3.93 0 7.44 1.83 9.72 4.67L448.6 128.34c2.2 2.37 3.27 5.4 3.27 8.41l.05 310.01c0 35.42-29.4 64.8-64.8 64.8H122.91c-35.57 0-64.81-29.23-64.81-64.8V64.8C58.1 29.13 87.23 0 122.91 0zM330.5 37.15V90.1c2.4 31.33 23.57 42.98 52.94 43.49l36.15-.04-89.09-96.4zm96.51 121.3l-43.78-.03c-42.59-.69-74.12-21.97-77.53-66.55l-.1-66.95H122.91c-21.93 0-39.89 17.96-39.89 39.88v381.96c0 21.82 18.07 39.89 39.89 39.89h264.21c21.72 0 39.89-18.15 39.89-39.89V158.45z"
            />
            <path
              fill="red"
              d="M28.04 194.61h453.92c15.42 0 28.04 12.65 28.04 28.04v188.54c0 15.4-12.65 28.05-28.04 28.05H28.04C12.65 439.24 0 426.62 0 411.19V222.65c0-15.42 12.62-28.04 28.04-28.04z"
            />
            <path
              fill="#fff"
              fillRule="nonzero"
              d="M48.16 377.39l-3.87-30.96h16.06c4 0 6.55-.55 7.64-1.64 1.1-1.1 1.65-2.48 1.65-4.16v-53.21H53.58v-30.96h54.75v89.01c0 10.44-2.57 18.38-7.73 23.79-5.16 5.42-12.58 8.13-22.26 8.13H48.16zm71.78-2.13l5.42-31.92c11.87 2.96 22.54 4.45 32.02 4.45 9.49 0 17.13-.39 22.93-1.16v-9.68l-17.41-1.55c-15.74-1.42-26.54-5.19-32.41-11.32-5.87-6.12-8.8-15.19-8.8-27.18 0-16.51 3.57-27.86 10.73-34.06 7.16-6.19 19.32-9.28 36.48-9.28 17.15 0 32.63 1.61 46.44 4.83l-4.84 30.96c-12-1.93-21.61-2.9-28.83-2.9-7.23 0-13.35.32-18.38.97v9.48l13.93 1.35c16.9 1.68 28.57 5.71 35.02 12.1 6.45 6.38 9.67 15.25 9.67 26.6 0 8.13-1.09 15-3.29 20.61-2.19 5.61-4.8 9.87-7.83 12.77-3.03 2.9-7.32 5.13-12.87 6.67-5.55 1.55-10.42 2.49-14.61 2.81-4.19.32-9.77.48-16.73.48-16.77 0-32.32-1.67-46.64-5.03zm110.68-58.24c0-22.06 4.13-38.15 12.39-48.27 8.25-10.13 23.15-15.19 44.69-15.19 21.55 0 36.44 5.06 44.7 15.19 8.25 10.12 12.38 26.21 12.38 48.27 0 10.97-.87 20.19-2.61 27.67-1.74 7.48-4.74 14-9 19.54-4.25 5.55-10.12 9.61-17.6 12.19-7.49 2.58-16.77 3.87-27.87 3.87-11.09 0-20.38-1.29-27.86-3.87s-13.35-6.64-17.61-12.19c-4.26-5.54-7.25-12.06-9-19.54-1.74-7.48-2.61-16.7-2.61-27.67zm41.6-20.12v50.31h16.06c5.29 0 9.13-.62 11.52-1.84 2.38-1.23 3.58-4.03 3.58-8.42v-50.31h-16.26c-5.16 0-8.93.62-11.32 1.84-2.38 1.23-3.58 4.03-3.58 8.42zm157.12 80.49l-31.54-52.24h-.77v52.24h-38.7V256.46h36.37l31.54 52.24h.78v-52.24h38.7v120.93h-36.38z"
            />
          </svg>
        );
      case "yml":
      case "yaml":
        return (
          <svg
            className="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
          >
            <title>file_type_yaml</title>
            <path
              d="M2,12.218c.755,0,1.51-.008,2.264,0l.053.038Q5.7,13.638,7.078,15.014c.891-.906,1.8-1.794,2.7-2.7.053-.052.11-.113.192-.1.608,0,1.215,0,1.823,0a1.4,1.4,0,0,1,.353.019c-.7.67-1.377,1.369-2.069,2.05L5.545,18.8c-.331.324-.648.663-.989.975-.754.022-1.511.007-2.266.007,1.223-1.209,2.431-2.433,3.658-3.637C4.627,14.841,3.318,13.525,2,12.218Z"
              style={{ fill: "#ffe885" }}
            />
            <path
              d="M12.7,12.218c.613,0,1.226,0,1.839,0q0,3.783,0,7.566c-.611,0-1.222.012-1.832-.008,0-1.664,0-3.329,0-4.994-1.6,1.607-3.209,3.2-4.811,4.8-.089.08-.166.217-.305.194-.824-.006-1.649,0-2.474,0Q8.916,16,12.7,12.218Z"
              style={{ fill: "#ffe885" }}
            />
            <path
              d="M14.958,12.22c.47-.009.939,0,1.409,0,.836.853,1.69,1.689,2.536,2.532q1.268-1.267,2.539-2.532.7,0,1.4,0-.008,3.784,0,7.567c-.471,0-.943.006-1.414,0q.008-2.387,0-4.773c-.844.843-1.676,1.7-2.526,2.536-.856-.835-1.687-1.695-2.532-2.541,0,1.594-.006,3.188.006,4.781-.472,0-.943.005-1.415,0Q14.958,16,14.958,12.22Z"
              style={{ fill: "#ffe885" }}
            />
            <path
              d="M23.259,12.217c.472,0,.944-.007,1.416,0q-.007,3.083,0,6.166c1.26,0,2.521,0,3.782,0,.063.006.144-.012.191.045.448.454.907.9,1.353,1.354q-3.371.007-6.741,0Q23.267,16,23.259,12.217Z"
              style={{ fill: "#ffe885" }}
            />
          </svg>
        );
      case "md":
      case "mdx":
        return (
          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <title>file_type_mdx</title>
            <path
              d="M20.3,16.5l-3.9,3.9-4-3.9,1.1-1.1,2.1,2.1V11.8h1.5v5.8l2.1-2.1ZM3.5,15.7l2.7,2.7L9,15.7v4.4h1.5V12L6.2,16.3,2,12v8.1H3.5Z"
              style={{ fill: "#d2d2d2" }}
            />
            <path
              d="M28.8,20l-3.1-3.1L22.6,20l-1-1.1,3.1-3.1-3.2-3.2,1.1-1,3.1,3.2,3.2-3.2,1.1,1-3.2,3.2,3.1,3.1Z"
              style={{ fill: "#f9ac00" }}
            />
          </svg>
        );
      case "css":
      case "scss":
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#EC4899"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#EC4899"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="10"
              fontWeight="bold"
              fill="#EC4899"
              textAnchor="middle"
            >
              CSS
            </text>
          </svg>
        );
      case "html":
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#F97316"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#F97316"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="9"
              fontWeight="bold"
              fill="#F97316"
              textAnchor="middle"
            >
              HTML
            </text>
          </svg>
        );
      case "xml":
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#8B5CF6"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#8B5CF6"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="10"
              fontWeight="bold"
              fill="#8B5CF6"
              textAnchor="middle"
            >
              XML
            </text>
          </svg>
        );
      case "py":
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#3B82F6"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#3B82F6"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="11"
              fontWeight="bold"
              fill="#3B82F6"
              textAnchor="middle"
            >
              PY
            </text>
          </svg>
        );
      case "go":
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#06B6D4"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#06B6D4"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="11"
              fontWeight="bold"
              fill="#06B6D4"
              textAnchor="middle"
            >
              GO
            </text>
          </svg>
        );
      case "rs":
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#F97316"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#F97316"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="11"
              fontWeight="bold"
              fill="#F97316"
              textAnchor="middle"
            >
              RS
            </text>
          </svg>
        );
      default:
        return <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />;
    }
  };

  return (
    <div
      className="flex items-start gap-2 py-0.5"
      style={{ marginLeft: `${level * 24}px` }}
    >
      {getFileIcon()}
      <span className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold">{name}</span>
        {comment && (
          <span className="text-sm text-muted-foreground">- {comment}</span>
        )}
      </span>
    </div>
  );
}

// Attach sub-components to FileTree
FileTree.Folder = Folder;
FileTree.File = FileComponent;

// Export sub-components individually for MDX
export const FileTreeFolder = Folder;
export const FileTreeFile = FileComponent;

// Export default for MDX compatibility
export default FileTree;
