import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  TextField,
  Checkbox,
  Toolbar,
  Typography,
  Tooltip,
  IconButton,
  CircularProgress,
  InputAdornment,
  Stack,
  Button,
  Menu,
  MenuItem,
  Divider,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  ViewColumn as ViewColumnIcon,
  ContentCopy as CopyIcon,
  FileDownload as ExportIcon,
  Print as PrintIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
} from '@mui/icons-material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper comparator logic for sorting
const descendingComparator = (a, b, orderBy) => {
  const aVal = a[orderBy] ? String(a[orderBy]).toLowerCase() : '';
  const bVal = b[orderBy] ? String(b[orderBy]).toLowerCase() : '';

  if (bVal < aVal) return -1;
  if (bVal > aVal) return 1;
  return 0;
};

const getComparator = (order, orderBy) => {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
};

const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  selected = [],
  onSelectedChange = () => { },
  bulkActions = [],
  searchPlaceholder = 'Search...',
  renderExpandedRow,
  storageKey = '',
  initialSearchQuery = ''
}) => {
  const [searchQuery, setSearchQuery] = useState(() => {
    if (initialSearchQuery) return initialSearchQuery;
    if (storageKey) {
      return sessionStorage.getItem(`${storageKey}_search`) || '';
    }
    return '';
  });
  const [orderBy, setOrderBy] = useState('');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(() => {
    if (storageKey) {
      const stored = sessionStorage.getItem(`${storageKey}_page`);
      return stored ? parseInt(stored, 10) : 0;
    }
    return 0;
  });
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    if (storageKey) {
      const stored = sessionStorage.getItem(`${storageKey}_rpp`);
      return stored ? parseInt(stored, 10) : 10;
    }
    return 10;
  });
  const [copySnackbar, setCopySnackbar] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  // Sync initialSearchQuery if prop changes externally
  useEffect(() => {
    if (initialSearchQuery !== undefined && initialSearchQuery !== null && initialSearchQuery !== '') {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  // Persist search query, page, and rowsPerPage in sessionStorage
  useEffect(() => {
    if (storageKey) {
      if (searchQuery) {
        sessionStorage.setItem(`${storageKey}_search`, searchQuery);
      } else {
        sessionStorage.removeItem(`${storageKey}_search`);
      }
    }
  }, [storageKey, searchQuery]);

  useEffect(() => {
    if (storageKey) {
      sessionStorage.setItem(`${storageKey}_page`, page.toString());
    }
  }, [storageKey, page]);

  useEffect(() => {
    if (storageKey) {
      sessionStorage.setItem(`${storageKey}_rpp`, rowsPerPage.toString());
    }
  }, [storageKey, rowsPerPage]);

  const toggleRowExpand = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Visibility and Reordering States
  const [visibleColumns, setVisibleColumns] = useState(() => columns.map(c => c.id));
  const [columnOrder, setColumnOrder] = useState(() => columns.map(c => c.id));
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  // Sync columns if prop changes
  useEffect(() => {
    setVisibleColumns(columns.map(c => c.id));
    setColumnOrder(columns.map(c => c.id));
  }, [columns]);

  // Reset page to 0 when search query changes
  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = filteredData.map((n) => n.id);
      onSelectedChange(newSelecteds);
      return;
    }
    onSelectedChange([]);
  };

  const handleCheckboxClick = (event, id) => {
    event.stopPropagation();
    toggleSelection(id);
  };

  const handleRowClick = (event, row) => {
    if (renderExpandedRow) {
      toggleRowExpand(row.id);
    } else {
      toggleSelection(row.id);
    }
  };

  const toggleSelection = (id) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }
    onSelectedChange(newSelected);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Toggle visible columns
  const handleToggleColumn = (columnId) => {
    setVisibleColumns(prev =>
      prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  // Native HTML5 Drag and Drop Column Reordering Handlers
  const handleDragStart = (e, columnId) => {
    e.dataTransfer.setData('text/plain', columnId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetColumnId) => {
    e.preventDefault();
    const sourceColumnId = e.dataTransfer.getData('text/plain');
    if (sourceColumnId === targetColumnId) return;

    const sourceIndex = columnOrder.indexOf(sourceColumnId);
    const targetIndex = columnOrder.indexOf(targetColumnId);

    const newOrder = [...columnOrder];
    newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, sourceColumnId);

    setColumnOrder(newOrder);
  };

  // ── Export helpers ────────────────────────────────────────────

  // Get exportable columns (exclude 'actions') and their plain-text values
  const exportColumns = columns.filter(c => c.id !== 'actions');

  const getPlainValue = (row, column) => {
    const val = row[column.id];
    if (val === null || val === undefined) return '';
    // If column has a render fn, try to extract text from React element
    if (column.render) {
      const rendered = column.render(row);
      if (typeof rendered === 'string' || typeof rendered === 'number') return String(rendered);
      // fallback to raw value
      return String(val);
    }
    return String(val);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = exportColumns.map(c => c.label);
    const rows = filteredData.map((row, i) => [
      i + 1,
      ...exportColumns.map(col => getPlainValue(row, col))
    ]);
    const csvContent = [
      ['#', ...headers].join(','),
      ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'export.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copy to clipboard (tab-separated)
  const handleCopy = () => {
    const headers = ['#', ...exportColumns.map(c => c.label)];
    const rows = filteredData.map((row, i) => [
      i + 1,
      ...exportColumns.map(col => getPlainValue(row, col))
    ]);
    const text = [headers, ...rows].map(r => r.join('\t')).join('\n');
    navigator.clipboard.writeText(text).then(() => setCopySnackbar(true));
  };

  // Print PDF
  const handlePrintPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const headers = [['#', ...exportColumns.map(c => c.label)]];
    const rows = filteredData.map((row, i) => [
      i + 1,
      ...exportColumns.map(col => getPlainValue(row, col))
    ]);
    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 20,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 10, right: 10 },
    });
    doc.save('export.pdf');
  };

  // 1. Search / Filter logic (Word-based multi-token substring search)
  const extractSearchableText = (row) => {
    let text = '';
    const collectStrings = (obj) => {
      if (obj === null || obj === undefined) return;
      if (typeof obj === 'string' || typeof obj === 'number') {
        text += ' ' + obj;
        return;
      }
      if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          if (key === 'id' || key === 'imagePath' || key === 'createdAt' || key === 'updatedAt') continue;
          collectStrings(obj[key]);
        }
      }
    };
    collectStrings(row);

    if (columns && Array.isArray(columns)) {
      for (const col of columns) {
        if (col.id === 'actions') continue;
        if (col.render) {
          try {
            const rendered = col.render(row);
            if (typeof rendered === 'string' || typeof rendered === 'number') {
              text += ' ' + rendered;
            }
          } catch (e) {}
        }
      }
    }
    return text.toLowerCase();
  };

  const filteredData = data.filter((row) => {
    if (!searchQuery || !searchQuery.trim()) return true;
    const words = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;

    const searchableText = extractSearchableText(row);
    // Every word must be present somewhere in searchable text
    return words.every(word => searchableText.includes(word));
  });

  // 2. Sort logic
  const sortedData = [...filteredData].sort(getComparator(order, orderBy));

  // 3. Pagination slice
  const paginatedData = sortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const isSelected = (id) => selected.indexOf(id) !== -1;

  // Filter columns to render in correct order and only if visible (always keep actions column)
  const activeColumns = columnOrder
    .map(id => columns.find(c => c.id === id))
    .filter(c => c && (visibleColumns.includes(c.id) || c.id === 'actions'));

  return (
    <Box sx={{ width: '100%' }}>
      {/* Table Toolbar (Search / Bulk actions) */}
      <Toolbar
        sx={{
          pl: { sm: 2 },
          pr: { xs: 1, sm: 2 },
          py: 1.5,
          borderBottom: '1px solid #e2e8f0',
          bgcolor: selected.length > 0 ? '#eff6ff' : 'transparent',
          transition: 'background-color 0.2s ease',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: '8px 8px 0 0'
        }}
      >
        {selected.length > 0 ? (
          <Typography
            sx={{ flex: '1 1 100%', color: '#1e3a8a', fontWeight: 600, fontSize: '0.875rem' }}
            variant="subtitle1"
            component="div"
          >
            {selected.length} row{selected.length > 1 ? 's' : ''} selected
          </Typography>
        ) : (
          <TextField
            placeholder={searchPlaceholder}
            variant="standard"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setSearchQuery('')} size="small">
                      <ClearIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  px: 1.5,
                  py: 0.5,
                  fontSize: '0.85rem',
                  width: { xs: '100%', sm: 260 },
                  '&:hover': {
                    borderColor: '#cbd5e1'
                  }
                }
              }
            }}
          />
        )}

        <Stack direction="row" spacing={1} alignItems="center">
          {/* Export / Copy / Print — only when no rows selected */}
          {!selected.length && (
            <>
              <Tooltip title="Copy to Clipboard">
                <IconButton
                  onClick={handleCopy}
                  size="small"
                  sx={{ border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#ffffff', '&:hover': { bgcolor: '#f0fdf4' } }}
                >
                  <CopyIcon sx={{ color: '#16a34a', fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export CSV">
                <IconButton
                  onClick={handleExportCSV}
                  size="small"
                  sx={{ border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#ffffff', '&:hover': { bgcolor: '#eff6ff' } }}
                >
                  <ExportIcon sx={{ color: '#2563eb', fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Print / Save PDF">
                <IconButton
                  onClick={handlePrintPDF}
                  size="small"
                  sx={{ border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#ffffff', '&:hover': { bgcolor: '#fef2f2' } }}
                >
                  <PrintIcon sx={{ color: '#dc2626', fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 24, alignSelf: 'center' }} />
              <Tooltip title="Show/Hide Columns">
                <IconButton
                  onClick={(e) => setMenuAnchorEl(e.currentTarget)}
                  size="small"
                  sx={{ border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#ffffff', '&:hover': { bgcolor: '#f8fafc' } }}
                >
                  <ViewColumnIcon sx={{ color: '#64748b', fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            </>
          )}

          {selected.length > 0 && (
            <Stack direction="row" spacing={1}>
              {bulkActions.map((action, idx) => (
                <Tooltip key={idx} title={action.label}>
                  <Button
                    variant="contained"
                    color={action.color || 'primary'}
                    startIcon={action.icon}
                    onClick={() => action.action(selected)}
                    size="small"
                    sx={{
                      borderRadius: 1.5,
                      px: 2,
                      py: 0.75,
                      fontSize: '0.8rem',
                      boxShadow: 'none',
                      whiteSpace: 'nowrap',
                      '&:hover': { boxShadow: 'none' }
                    }}
                  >
                    {action.label}
                  </Button>
                </Tooltip>
              ))}
            </Stack>
          )}
        </Stack>
      </Toolbar>

      {/* Column Visibility Settings Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => setMenuAnchorEl(null)}
        PaperProps={{
          sx: {
            p: 1,
            borderRadius: 2,
            minWidth: 180,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)'
          }
        }}
      >
        <Typography
          variant="caption"
          sx={{ px: 2, py: 0.5, fontWeight: 700, color: '#94a3b8', display: 'block', letterSpacing: '0.5px' }}
        >
          SHOW / HIDE COLUMNS
        </Typography>
        <Divider sx={{ my: 0.5 }} />
        {columns.map((column) => (
          <MenuItem
            key={column.id}
            onClick={() => handleToggleColumn(column.id)}
            sx={{ py: 0.5, borderRadius: 1.5, fontSize: '0.85rem', color: '#475569' }}
          >
            <Checkbox
              checked={visibleColumns.includes(column.id)}
              size="small"
              sx={{ p: 0.5, mr: 1 }}
            />
            {column.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Table Container */}
      <TableContainer sx={{ minHeight: 200, position: 'relative' }}>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              bgcolor: 'rgba(255, 255, 255, 0.7)',
              zIndex: 10
            }}
          >
            <CircularProgress size={32} />
          </Box>
        ) : null}

        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow sx={{ '& th': { fontWeight: 600, color: '#475569', py: 1.5, borderBottom: '1px solid #e2e8f0' } }}>
              <TableCell padding="checkbox" sx={{ pl: 2 }} style={{ width: 50 }}>
                <Checkbox
                  color="primary"
                  indeterminate={selected.length > 0 && selected.length < filteredData.length}
                  checked={filteredData.length > 0 && selected.length === filteredData.length}
                  onChange={handleSelectAllClick}
                  size="small"
                />
              </TableCell>
              {renderExpandedRow && <TableCell style={{ width: 40 }}></TableCell>}
              <TableCell sx={{ pl: 1 }} style={{ width: 60 }}>No.</TableCell>
              {activeColumns.map((column) => (
                <TableCell
                  key={column.id}
                  sortDirection={orderBy === column.id ? order : false}
                  align={column.align || 'left'}
                  draggable={column.id !== 'actions'}
                  onDragStart={(e) => handleDragStart(e, column.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.id)}
                  style={{
                    width: column.width || 'auto',
                    cursor: column.id !== 'actions' ? 'grab' : 'default',
                    userSelect: 'none'
                  }}
                >
                  {column.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleRequestSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody sx={{ '& tr': { '&:hover': { bgcolor: '#f8fafc' } }, '& td': { borderBottom: '1px solid #f1f5f9', py: 1.5, color: '#475569', fontSize: '0.85rem' } }}>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={activeColumns.length + (renderExpandedRow ? 3 : 2)} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {searchQuery ? 'No matching records found.' : 'No data available.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => {
                const isItemSelected = isSelected(row.id);
                const itemIndex = page * rowsPerPage + index + 1;
                const isExpanded = !!expandedRows[row.id];

                return (
                  <React.Fragment key={row.id}>
                    <TableRow
                      hover
                      onClick={(event) => handleRowClick(event, row)}
                      role="checkbox"
                      aria-checked={isItemSelected}
                      tabIndex={-1}
                      selected={isItemSelected}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox" sx={{ pl: 2 }} style={{ width: 50 }}>
                        <Checkbox
                          color="primary"
                          checked={isItemSelected}
                          onChange={(event) => handleCheckboxClick(event, row.id)}
                          size="small"
                        />
                      </TableCell>
                      {renderExpandedRow && (
                        <TableCell sx={{ p: 0 }} align="center" style={{ width: 40 }}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpand(row.id);
                            }}
                          >
                            {isExpanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                          </IconButton>
                        </TableCell>
                      )}
                      <TableCell sx={{ pl: 1, color: '#94a3b8' }} style={{ width: 60 }}>{itemIndex}</TableCell>
                      {activeColumns.map((column) => {
                        const value = row[column.id];
                        return (
                          <TableCell
                            key={column.id}
                            align={column.align || 'left'}
                            sx={column.cellSx}
                            style={{
                              width: column.width || 'auto',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {column.render ? column.render(row) : (value || '-')}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    {renderExpandedRow && isExpanded && (
                      <TableRow sx={{ bgcolor: '#f8fafc', '&:hover': { bgcolor: '#f8fafc !important' } }}>
                        <TableCell colSpan={activeColumns.length + 3} sx={{ p: 0, borderBottom: '1px solid #e2e8f0' }}>
                          <Box sx={{ py: 0.5, px: 3 }}>
                            {renderExpandedRow(row)}
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Table Pagination */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={filteredData.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{
          borderTop: '1px solid #e2e8f0',
          '.MuiTablePagination-toolbar': {
            minHeight: 48,
            fontSize: '0.8rem'
          },
          '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
            fontSize: '0.8rem',
            color: '#64748b'
          }
        }}
      />
      {/* Copy success snackbar */}
      <Snackbar
        open={copySnackbar}
        autoHideDuration={2000}
        onClose={() => setCopySnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" sx={{ borderRadius: 2, fontSize: '0.85rem' }}>
          Copied to clipboard!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DataTable;
