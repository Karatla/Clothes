"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type SearchableOption = {
  value: string;
  label: string;
  /** 显示在标题下方的小字，如订单日期、金额 */
  description?: string;
  /** 额外参与搜索的内容，如标签、款号 */
  keywords?: string;
};

type Props = {
  value: string | null;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  /** 搜索框下方的附加筛选控件，如日期范围 */
  filters?: ReactNode;
};

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "请选择",
  searchPlaceholder = "输入关键词搜索",
  emptyText = "没有匹配的结果",
  disabled = false,
  className = "",
  filters,
}: Props) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = options.find((option) => option.value === value) ?? null;

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""} ${option.keywords ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [options, keyword]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setKeyword("");
    }
  }, [open]);

  const commit = (option: SearchableOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) commit(option);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-[#e4d7c5] bg-white px-3 py-2 text-left text-sm text-[#1f1811] disabled:bg-[#f5efe6] disabled:text-[#9c9384]"
      >
        <span className="truncate">
          {selected ? (
            <>
              {selected.label}
              {selected.description ? (
                <span className="ml-2 text-xs text-[#8a8073]">
                  {selected.description}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-[#9c9384]">{placeholder}</span>
          )}
        </span>
        <span className="shrink-0 text-xs text-[#9c9384]">▾</span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-full min-w-[16rem] rounded-2xl border border-[#e4d7c5] bg-white p-3 shadow-[0_25px_70px_-40px_rgba(36,27,14,0.6)]">
          <input
            ref={inputRef}
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-[#e4d7c5] px-3 py-2 text-sm"
          />

          {filters ? <div className="mt-2">{filters}</div> : null}

          <div className="mt-2 flex items-center justify-between px-1 text-xs text-[#8a8073]">
            <span>共 {filtered.length} 条</span>
            {keyword.trim() ? (
              <button
                type="button"
                onClick={() => setKeyword("")}
                className="text-[#6b645a] underline"
              >
                清空搜索
              </button>
            ) : null}
          </div>

          <div className="mt-1 max-h-64 overflow-y-auto">
            {filtered.length ? (
              filtered.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(option)}
                  className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${
                    option.value === value
                      ? "bg-[#1f1811] text-white"
                      : index === activeIndex
                        ? "bg-[#f5efe6] text-[#1f1811]"
                        : "text-[#1f1811]"
                  }`}
                >
                  <div className="truncate">{option.label}</div>
                  {option.description ? (
                    <div
                      className={`truncate text-xs ${
                        option.value === value
                          ? "text-[#d9d2c6]"
                          : "text-[#8a8073]"
                      }`}
                    >
                      {option.description}
                    </div>
                  ) : null}
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-sm text-[#8a8073]">
                {emptyText}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
