/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Search, 
  Download, 
  Filter, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  FilterX,
  FileText,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { cn } from './lib/utils';

// --- Types ---
type DataRow = Record<string, any>;

interface FilterState {
  column: string;
  values: Set<string>;
  searchTerm: string;
}

const ITEMS_PER_PAGE = 25;

export default function App() {
  const [data, setData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, FilterState>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setIsLoading(true);
    setFileName(file.name);
    setCurrentPage(1);
    setActiveFilters({});
    setSearchQuery('');

    const reader = new FileReader();

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          setData(results.data as DataRow[]);
          if (results.data.length > 0) {
            setColumns(Object.keys(results.data[0]));
          }
          setIsLoading(false);
        }
      });
    } else {
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        setData(json as DataRow[]);
        if (json.length > 0) {
          setColumns(Object.keys(json[0] as object));
        }
        setIsLoading(false);
      };
      reader.readAsBinaryString(file);
    }
  };

  const downloadFilteredCSV = () => {
    if (filteredData.length === 0) return;
    const csv = Papa.unparse(filteredData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `filtered_${fileName || 'data'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Filtering Logic ---
  const columnMetadata = useMemo(() => {
    const meta: Record<string, { uniqueValues: string[], isCategorical: boolean }> = {};
    columns.forEach(col => {
      const unique = Array.from(new Set(data.map(row => String(row[col] ?? '')))).filter(v => v !== '');
      meta[col] = {
        uniqueValues: unique.sort() as string[],
        isCategorical: unique.length > 0 && unique.length < Math.min(50, data.length * 0.1)
      };
    });
    return meta;
  }, [data, columns]);

  const filteredData = useMemo(() => {
    return data.filter(row => {
      if (searchQuery) {
        const rowString = Object.values(row).join(' ').toLowerCase();
        if (!rowString.includes(searchQuery.toLowerCase())) return false;
      }

      for (const [col, filter] of Object.entries(activeFilters)) {
        const f = filter as FilterState;
        if (f.values.size > 0) {
          const rowVal = String(row[col] ?? '');
          if (!f.values.has(rowVal)) return false;
        }
        if (f.searchTerm) {
          const rowVal = String(row[col] ?? '').toLowerCase();
          if (!rowVal.includes(f.searchTerm.toLowerCase())) return false;
        }
      }
      return true;
    });
  }, [data, searchQuery, activeFilters]);

  // --- Pagination ---
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const toggleFilterValue = (column: string, value: string) => {
    setActiveFilters(prev => {
      const current = prev[column] || { column, values: new Set(), searchTerm: '' };
      const newValues = new Set(current.values);
      if (newValues.has(value)) {
        newValues.delete(value);
      } else {
        newValues.add(value);
      }
      const newState = { ...prev };
      if (newValues.size === 0 && !current.searchTerm) {
        delete newState[column];
      } else {
        newState[column] = { ...current, values: newValues };
      }
      return newState;
    });
    setCurrentPage(1);
  };

  const updateColumnSearch = (column: string, term: string) => {
    setActiveFilters(prev => {
      const current = prev[column] || { column, values: new Set(), searchTerm: '' };
      const newState = { ...prev };
      if (!term && current.values.size === 0) {
        delete newState[column];
      } else {
        newState[column] = { ...current, searchTerm: term };
      }
      return newState;
    });
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setActiveFilters({});
    setSearchQuery('');
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800">
            DataFilter<span className="text-blue-600">Pro</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm flex items-center gap-2">
            <Upload className="w-4 h-4" />
            <span>{data.length > 0 ? 'Change File' : 'Upload CSV/Excel'}</span>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".csv,.xlsx,.xls" 
              onChange={handleFileUpload} 
            />
          </label>
          
          {data.length > 0 && (
            <button 
              onClick={downloadFilteredCSV}
              className="flex items-center gap-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Filtered CSV
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {data.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md w-full text-center"
            >
              {isLoading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                  <p className="text-slate-500 font-medium">Analyzing dataset structures...</p>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 mb-2">Ready for analysis</h2>
                  <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                    Drop a spreadsheet or CSV here. Our engine handles millions of rows efficiently within your browser.
                  </p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-100"
                  >
                    Select File to Start
                  </button>
                </>
              )}
            </motion.div>
          </div>
        ) : (
          <>
            {/* Sidebar Filters */}
            <aside className="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-y-auto p-6 space-y-8 z-10">
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Filters</h2>
                  <button 
                    onClick={clearAllFilters}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase"
                  >
                    Reset
                  </button>
                </div>
                
                <div className="space-y-6">
                  {/* Global Search */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Search results</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Type to search..."
                        className="w-full text-sm border-slate-200 bg-slate-50 rounded-md py-1.5 pl-9 pr-3 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Column Filters */}
                  {columns.map(col => {
                    const meta = columnMetadata[col];
                    const currentFilter = activeFilters[col];
                    
                    return (
                      <div key={col} className="filter-group border-t border-slate-100 pt-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2 truncate" title={col}>
                          {col}
                        </label>
                        
                        {meta.isCategorical ? (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                            {meta.uniqueValues.map(val => (
                              <label key={val} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer group">
                                <input 
                                  type="checkbox" 
                                  checked={currentFilter?.values.has(val) || false}
                                  onChange={() => toggleFilterValue(col, val)}
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="group-hover:text-slate-900 transition-colors truncate">{val}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <input 
                              type="text"
                              value={currentFilter?.searchTerm || ''}
                              onChange={(e) => updateColumnSearch(col, e.target.value)}
                              placeholder="Filter..."
                              className="w-full pl-7 pr-3 py-1 bg-white border border-slate-100 rounded text-xs focus:border-blue-400 outline-none transition-all"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="mt-auto border-t border-slate-100 pt-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-700 font-medium mb-1">Processing Performance</p>
                  <div className="h-1.5 w-full bg-blue-200 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(filteredData.length / data.length) * 100}%` }}
                      className="h-full bg-blue-500"
                    />
                  </div>
                  <p className="text-[10px] text-blue-600 mt-2">Viewing {filteredData.length.toLocaleString()} of {data.length.toLocaleString()} items</p>
                </div>
              </section>
            </aside>

            {/* Table Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
              {/* Table Sub-header */}
              <div className="h-12 border-b border-slate-100 flex items-center justify-between px-6 shrink-0 bg-white">
                <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500 uppercase tracking-tight">
                  <span>Showing {paginatedData.length} per page</span>
                  <span className="h-4 w-px bg-slate-200"></span>
                  <span>{fileName}</span>
                </div>
                
                {/* Minimal Pagination */}
                <div className="flex items-center gap-1">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-700 mx-2">Page {currentPage} of {totalPages || 1}</span>
                  <button 
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-slate-50/20">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm border-b border-slate-200">
                    <tr>
                      {columns.map(col => (
                        <th key={col} className="p-4 text-xs font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-600 bg-white">
                    {paginatedData.length > 0 ? (
                      paginatedData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                          {columns.map(col => (
                            <td key={col} className="p-4 whitespace-nowrap border-b border-slate-50">
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={columns.length} className="p-12 text-center">
                          <div className="flex flex-col items-center opacity-40">
                            <FilterX className="w-12 h-12 mb-2" />
                            <p className="text-sm font-medium">No results match your current filters</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom Footer Stats */}
              <footer className="h-10 bg-slate-50 border-t border-slate-200 px-6 flex items-center justify-between shrink-0 text-[10px] text-slate-400 font-medium italic">
                <div className="flex items-center gap-4">
                  <span>Engine: Browser-Native WASM</span>
                  <span>|</span>
                  <span>Safety: In-Memory Only</span>
                </div>
                <div className="flex items-center gap-4">
                  <span>{filteredData.length.toLocaleString()} rows visible</span>
                  <span className="h-3 w-px bg-slate-300"></span>
                  <span>V1.0.0-STABLE</span>
                </div>
              </footer>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

