"use client";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

export const TipTapContentViewer = ({ content }: { content: string }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          HTMLAttributes: {
            class: "text-xl",
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: "list-disc pl-5 space-y-2",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal pl-4",
          },
        },
      }),
    ],
    content: "",
    editable: false,
    immediatelyRender: false,
  });
  useEffect(() => {
    editor?.commands.setContent(content);
  }, [content, editor]);
  return <EditorContent className="min-w-0 max-w-full leading-relaxed [overflow-wrap:anywhere] [&_p]:my-2" editor={editor} />;
};
