import { useMemo, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataGrid } from '@/components/data-grid';
import type { DocField } from '@/lib/data-grid/frappe-meta';
import { useDirection } from '@sear/contexts/DirectionContext';
import { fieldLibraryStore } from './fieldLibraryStore';

const BASE = '/workspace/build/sear_studio/field_library';

const fmtDate = (d: Date, isRTL: boolean) =>
  new Intl.DateTimeFormat(isRTL ? 'ar-EG' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);

export default function FieldLibraryListPage() {
  const { language } = useDirection();
  const isRTL = language === 'ar';
  const navigate = useNavigate();

  const presets = useSyncExternalStore(fieldLibraryStore.subscribe, fieldLibraryStore.list);

  const removeItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    fieldLibraryStore.remove(id);
  };

  // Flatten the store records into DataGrid rows (row.name is the stable key used for navigation).
  const rows = useMemo(() => presets.map((p) => ({
    name: p.id,
    preset_name: isRTL ? (p.nameAr || p.name) : p.name,
    description: p.description ?? '',
    fields_count: p.fields.length,
    created_by: p.createdBy,
    modified_at: p.modifiedAt.toISOString().slice(0, 10),
    _modifiedAt: p.modifiedAt,
  })), [presets, isRTL]);

  // Column + filter model (mock meta — no backend needed in the Frontend phase).
  const fields: DocField[] = useMemo(() => [
    { fieldname: 'preset_name', label: isRTL ? 'الاسم' : 'Name', fieldtype: 'Data', in_list_view: 1 },
    { fieldname: 'fields_count', label: isRTL ? 'الحقول' : 'Fields', fieldtype: 'Int', in_list_view: 1 },
    { fieldname: 'created_by', label: isRTL ? 'أنشئت بواسطة' : 'Created By', fieldtype: 'Data', in_standard_filter: 1 },
    { fieldname: 'modified_at', label: isRTL ? 'آخر تعديل' : 'Last Modified', fieldtype: 'Date', in_list_view: 1 },
    { fieldname: 'actions', label: isRTL ? 'إجراءات' : 'Actions', fieldtype: 'Data', in_list_view: 1 },
  ], [isRTL]);

  return (
    <div className="flex flex-col">
      <div className="px-6 md:px-8 py-6">
        <DataGrid
          className="sear-datagrid"
          doctype="Field Preset"
          mock={{ rows, fields }}
          onRowClick={(r) => navigate(`${BASE}/${r.name}/edit`)}
          renderCell={(row, key) => {
            if (key === 'preset_name') {
              return (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{row.preset_name}</p>
                    {row.description && <p className="text-[11px] text-muted-foreground truncate">{row.description}</p>}
                  </div>
                </div>
              );
            }
            if (key === 'fields_count') {
              return <span className="text-xs text-muted-foreground tabular-nums">{row.fields_count}</span>;
            }
            if (key === 'modified_at') {
              return <span className="text-xs text-muted-foreground">{fmtDate(row._modifiedAt, isRTL)}</span>;
            }
            if (key === 'actions') {
              return (
                <div className="flex items-center justify-start gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button aria-label={isRTL ? 'حذف' : 'Delete'} variant="outline" size="icon-sm" className="!rounded-lg !border-destructive/25 text-destructive"
                    onClick={(e) => removeItem(row.name, e)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            }
            return <span className="text-xs text-foreground/80 truncate">{row[key] ?? '—'}</span>;
          }}
          actions={
            <Button onClick={() => navigate(`${BASE}/new`)} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              {isRTL ? 'إنشاء مجموعة حقول' : 'Create Field Preset'}
            </Button>
          }
        />
      </div>
    </div>
  );
}
