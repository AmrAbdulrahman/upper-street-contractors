'use client';

/** Shared "sort by [field] [direction]" control for the Types and Entries lists. */

import { Button, Select } from './components/ui';

export type SortField = 'name' | 'created' | 'updated';
export type SortDir = 'asc' | 'desc';

export function SortControl({
  sortBy,
  onSortByChange,
  sortDir,
  onSortDirChange,
}: {
  sortBy: SortField;
  onSortByChange: (v: SortField) => void;
  sortDir: SortDir;
  onSortDirChange: (v: SortDir) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Select
        aria-label="Sort by"
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value as SortField)}
        className="max-w-36"
      >
        <option value="name">Name</option>
        <option value="created">Created</option>
        <option value="updated">Last modified</option>
      </Select>
      <Button
        aria-label={sortDir === 'asc' ? 'Ascending' : 'Descending'}
        title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
        onClick={() => onSortDirChange(sortDir === 'asc' ? 'desc' : 'asc')}
      >
        {sortDir === 'asc' ? '↑' : '↓'}
      </Button>
    </div>
  );
}
