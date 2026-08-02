import type { Prisma } from '@prisma/client';

/**
 * 商品标签存在 SQLite 的 JSON 字段里，Prisma 无法直接对它做 contains 查询，
 * 所以名称 / 款号 / 标签的关键词匹配统一放在内存里做。
 */
export const normalizeTags = (tags: Prisma.JsonValue | null | undefined) => {
  if (!Array.isArray(tags)) {
    return [] as string[];
  }

  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

export const matchesKeyword = (
  product: {
    name: string;
    baseCode: string;
    tags?: Prisma.JsonValue | null;
  },
  keyword: string,
) => {
  const needle = keyword.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  if (product.name.toLowerCase().includes(needle)) {
    return true;
  }
  if (product.baseCode.toLowerCase().includes(needle)) {
    return true;
  }

  return normalizeTags(product.tags).some((tag) =>
    tag.toLowerCase().includes(needle),
  );
};
