"use client";

import { Search } from "lucide-react";
import { Input } from "./ui/input";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <div className="relative min-w-0 w-full flex-1 sm:w-auto sm:flex-none">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        className="pl-8 h-8 w-full sm:w-[150px] lg:w-[200px] max-w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
