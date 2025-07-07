import React, { useState, useRef } from 'react';
import { useAppStore } from '../store';
import { 
  FolderPlus, 
  FileText, 
  Download, 
  Upload, 
  Copy, 
  Trash2, 
  Edit3, 
  Star, 
  Calendar,
  Users,
  Layers,
  BarChart3,
  Search,
  Filter,
  X,
  Save,
  ChevronDown
} from 'lucide-react';
import type { ProblemSummary } from '../types';

interface ProblemManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProblemManager({ isOpen, onClose }: ProblemManagerProps) {
  const {
    savedProblems,
    currentProblemId,
    loadSavedProblems,
    createNewProblem,
    loadProblem,
    deleteProblem,
    duplicateProblem,
    renameProblem,
    toggleTemplate,
    exportProblem,
    importProblem,
    saveProblem,
    problem: currentProblem,
    setProblem,
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTemplate, setFilterTemplate] = useState<'all' | 'templates' | 'problems'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProblemName, setNewProblemName] = useState('');
  const [newProblemIsTemplate, setNewProblemIsTemplate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newDropdownRef = useRef<HTMLDivElement>(null);
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [newProblemMode, setNewProblemMode] = useState<'duplicate' | 'empty'>('duplicate');

  React.useEffect(() => {
    if (isOpen) {
      loadSavedProblems();
    }
  }, [isOpen, loadSavedProblems]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(event.target as Node)) {
        setNewDropdownOpen(false);
      }
    };
    if (newDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [newDropdownOpen]);

  const problemSummaries: ProblemSummary[] = Object.values(savedProblems).map(p => ({
    id: p.id,
    name: p.name,
    peopleCount: p.problem?.people?.length || 0,
    groupsCount: p.problem?.groups?.length || 0,
    sessionsCount: p.problem?.num_sessions || 0,
    resultsCount: p.results?.length || 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    isTemplate: p.isTemplate,
  }));

  const filteredProblems = problemSummaries.filter(problem => {
    const matchesSearch = problem.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = 
      filterTemplate === 'all' ||
      (filterTemplate === 'templates' && problem.isTemplate) ||
      (filterTemplate === 'problems' && !problem.isTemplate);
    
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    // Sort templates first, then by updated date
    if (a.isTemplate && !b.isTemplate) return -1;
    if (!a.isTemplate && b.isTemplate) return 1;
    return b.updatedAt - a.updatedAt;
  });

  const handleCreateProblem = () => {
    if (!newProblemName.trim()) return;

    const minimalProblem = {
      people: [],
      groups: [],
      num_sessions: 1,
      constraints: [],
      settings: {
        solver_type: "SimulatedAnnealing",
        stop_conditions: {
          max_iterations: 10000,
          time_limit_seconds: 30,
          no_improvement_iterations: 5000,
        },
        solver_params: {
          SimulatedAnnealing: {
            initial_temperature: 1.0,
            final_temperature: 0.01,
            cooling_schedule: "geometric" as const,
            reheat_after_no_improvement: 0,
          },
        },
      },
    };

    if (newProblemMode === 'empty') {
      // set current problem to empty then save
      setProblem(minimalProblem);
    }

    createNewProblem(newProblemName, newProblemIsTemplate);
    setShowCreateDialog(false);
    setNewProblemName('');
    setNewProblemIsTemplate(false);
  };

  const handleSaveCurrentProblem = () => {
    if (!currentProblem) return;
    
    const name = currentProblemId 
      ? savedProblems[currentProblemId]?.name || 'Untitled Problem'
      : 'New Problem';
    
    saveProblem(name);
  };

  const handleRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleSaveRename = () => {
    if (editingId && editingName.trim()) {
      renameProblem(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleDuplicate = async (id: string, name: string) => {
    const newName = prompt(`Enter name for the duplicate of "${name}":`, `${name} (Copy)`);
    if (newName && newName.trim()) {
      const includeResults = confirm('Include existing results in the duplicate?');
      duplicateProblem(id, newName.trim(), includeResults);
    }
  };

  const handleDelete = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) {
      deleteProblem(showDeleteConfirm);
      setShowDeleteConfirm(null);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importProblem(file);
      event.target.value = ''; // Reset file input
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
      <div className="rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col modal-content">
        {/* Header */}
        <div className="relative border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 gap-4 sm:gap-0">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Problem Manager</h2>
              <p className="mt-1 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>Manage your saved problems and results</p>
            </div>
            {/* Desktop button group (unchanged) */}
            <div className="hidden sm:flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
              {currentProblem && (
                <button
                  onClick={handleSaveCurrentProblem}
                  className="btn-primary flex items-center justify-center space-x-2 px-4 py-2 text-sm"
                  aria-label="Save Current Problem"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Current</span>
                </button>
              )}
              <div className="relative" ref={newDropdownRef}>
                <button
                  onClick={() => setNewDropdownOpen(!newDropdownOpen)}
                  className="btn-primary flex items-center justify-center space-x-2 px-4 py-2 text-sm w-full sm:w-auto"
                  aria-label="New Problem"
                >
                  <FolderPlus className="h-4 w-4" />
                  <span>New Problem</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {newDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-56 rounded-md shadow-lg z-10 border overflow-hidden"
                       style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
                    <button
                      onClick={() => {
                        setNewProblemMode('empty');
                        setShowCreateDialog(true);
                        setNewDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors border-b last:border-b-0"
                      style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <FolderPlus className="h-4 w-4" />
                      Blank Problem
                    </button>
                    <button
                      onClick={() => {
                        setNewProblemMode('duplicate');
                        setShowCreateDialog(true);
                        setNewDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Copy className="h-4 w-4" />
                      Duplicate Current
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleImport}
                className="btn-secondary flex items-center justify-center space-x-2 px-4 py-2 text-sm"
                aria-label="Import Problem"
              >
                <Upload className="h-4 w-4" />
                <span>Import</span>
              </button>
              <button
                onClick={onClose}
                className="btn-secondary p-2"
                aria-label="Close Problem Manager"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Mobile button row */}
            <div className="flex sm:hidden items-center gap-1 absolute right-4 top-4 z-10">
              {currentProblem && (
                <button
                  onClick={handleSaveCurrentProblem}
                  className="btn-primary flex flex-col items-center justify-center px-2 py-1 text-xs"
                  aria-label="Save"
                >
                  <Save className="h-4 w-4 mb-0.5" />
                  <span>Save</span>
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setNewDropdownOpen(!newDropdownOpen)}
                  className="btn-primary flex flex-col items-center justify-center px-2 py-1 text-xs"
                  aria-label="New"
                >
                  <FolderPlus className="h-4 w-4 mb-0.5" />
                  <span>New</span>
                  <ChevronDown className="w-3 h-3 ml-1" />
                </button>
                {newDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-40 rounded-md shadow-lg z-20 border overflow-hidden"
                       style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
                    <button
                      onClick={() => {
                        setNewProblemMode('empty');
                        setShowCreateDialog(true);
                        setNewDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left transition-colors border-b last:border-b-0"
                      style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                    >
                      <FolderPlus className="h-4 w-4" />
                      Blank
                    </button>
                    <button
                      onClick={() => {
                        setNewProblemMode('duplicate');
                        setShowCreateDialog(true);
                        setNewDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <Copy className="h-4 w-4" />
                      Duplicate
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleImport}
                className="btn-secondary flex flex-col items-center justify-center px-2 py-1 text-xs"
                aria-label="Import"
              >
                <Upload className="h-4 w-4 mb-0.5" />
                <span>Import</span>
              </button>
              <button
                onClick={onClose}
                className="btn-secondary flex flex-col items-center justify-center px-2 py-1 text-xs border-l border-gray-300 ml-1"
                aria-label="Close"
                style={{ borderColor: 'var(--border-secondary)' }}
              >
                <X className="h-4 w-4 mb-0.5" />
                <span>Close</span>
              </button>
            </div>
          </div>
          {/* Divider for mobile */}
          <div className="sm:hidden border-b" style={{ borderColor: 'var(--border-secondary)' }}></div>
        </div>

        {/* Search and Filter */}
        <div className="p-4 sm:p-6 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Search problems..."
                className="input pl-10 w-full text-base py-3"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter style={{ color: 'var(--text-tertiary)' }} className="h-4 w-4" />
              <select
                className="input text-base py-3"
                value={filterTemplate}
                onChange={(e) => setFilterTemplate(e.target.value as 'all' | 'problems' | 'templates')}
              >
                <option value="all">All</option>
                <option value="problems">Problems</option>
                <option value="templates">Templates</option>
              </select>
            </div>
          </div>
        </div>

        {/* Problem List */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {filteredProblems.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No problems found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search terms.' : 'Create your first problem to get started.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProblems.map((problem) => (
                <div
                  key={problem.id}
                  className={`card hover:shadow-md transition-shadow cursor-pointer ${
                    problem.id === currentProblemId ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  {/* Problem Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      {editingId === problem.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            className="input text-sm flex-1"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename();
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                            autoFocus
                          />
                          <button
                            onClick={handleSaveRename}
                            className="text-green-600 hover:text-green-700 p-1"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancelRename}
                            className="text-red-600 hover:text-red-700 p-1"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center space-x-2"
                          onClick={() => loadProblem(problem.id)}
                        >
                          <h3 className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {problem.name}
                          </h3>
                          {problem.isTemplate && (
                            <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Problem Stats */}
                  <div 
                    className="grid grid-cols-2 gap-2 text-sm mb-3"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={() => loadProblem(problem.id)}
                  >
                    <div className="flex items-center space-x-1">
                      <Users className="h-3 w-3" />
                      <span>{problem.peopleCount} people</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Layers className="h-3 w-3" />
                      <span>{problem.groupsCount} groups</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{problem.sessionsCount} sessions</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <BarChart3 className="h-3 w-3" />
                      <span>{problem.resultsCount} results</span>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                    <div>Created: {formatDate(problem.createdAt)}</div>
                    <div>Updated: {formatDate(problem.updatedAt)}</div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRename(problem.id, problem.name);
                        }}
                        className="p-1 transition-colors"
                        style={{ color: 'var(--text-tertiary)' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                        title="Rename"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(problem.id, problem.name);
                        }}
                        className="p-1 transition-colors"
                        style={{ color: 'var(--text-tertiary)' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTemplate(problem.id);
                        }}
                        className="p-1 transition-colors"
                        style={{ color: problem.isTemplate ? 'var(--color-warning-500)' : 'var(--text-tertiary)' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = problem.isTemplate ? 'var(--color-warning-500)' : 'var(--text-tertiary)'}
                        title={problem.isTemplate ? 'Remove from templates' : 'Add to templates'}
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportProblem(problem.id);
                        }}
                        className="p-1 transition-colors"
                        style={{ color: 'var(--text-tertiary)' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                        title="Export"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(problem.id);
                        }}
                        className="p-1 transition-colors"
                        style={{ color: 'var(--color-error-400)' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-error-600)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-error-400)'}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileImport}
          className="hidden"
        />
      </div>

      {/* Create Problem Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-60 p-4">
          <div className="rounded-lg shadow-xl p-6 w-full max-w-md mx-auto modal-content">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {newProblemMode === 'empty' ? 'Create New Problem' : 'Duplicate Current Problem'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Problem Name</label>
                <input
                  type="text"
                  value={newProblemName}
                  onChange={(e) => setNewProblemName(e.target.value)}
                  className="input w-full text-base py-3"
                  placeholder="Enter problem name..."
                  autoFocus
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isTemplate"
                  checked={newProblemIsTemplate}
                  onChange={(e) => setNewProblemIsTemplate(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="isTemplate" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Save as template
                </label>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewProblemName('');
                  setNewProblemIsTemplate(false);
                }}
                className="btn-secondary flex-1 sm:flex-none px-6 py-3 text-base font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProblem}
                disabled={!newProblemName.trim()}
                className="btn-primary flex-1 sm:flex-none px-6 py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-60 p-4">
          <div className="rounded-lg shadow-xl p-6 w-full max-w-md mx-auto modal-content">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Confirm Delete</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Are you sure you want to delete this problem? This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary flex-1 sm:flex-none px-6 py-3 text-base font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="btn-error flex-1 sm:flex-none px-6 py-3 text-base font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 