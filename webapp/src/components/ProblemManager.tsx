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
  StarOff,
  Calendar,
  Users,
  Layers,
  BarChart3,
  Search,
  Filter,
  X,
  Save,
  AlertTriangle
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

  React.useEffect(() => {
    if (isOpen) {
      loadSavedProblems();
    }
  }, [isOpen, loadSavedProblems]);

  const problemSummaries: ProblemSummary[] = Object.values(savedProblems).map(p => ({
    id: p.id,
    name: p.name,
    peopleCount: p.problem.people.length,
    groupsCount: p.problem.groups.length,
    sessionsCount: p.problem.num_sessions,
    resultsCount: p.results.length,
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
    
    if (!currentProblem) {
      // Create a minimal problem structure
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
      // This will create an empty problem
      createNewProblem(newProblemName, newProblemIsTemplate);
    } else {
      createNewProblem(newProblemName, newProblemIsTemplate);
    }
    
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
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
              <div className="rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col modal-content">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Problem Manager</h2>
            <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Manage your saved problems and results</p>
          </div>
          <div className="flex items-center space-x-2">
            {currentProblem && (
              <button
                onClick={handleSaveCurrentProblem}
                className="btn-primary flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Save Current</span>
              </button>
            )}
            <button
              onClick={() => setShowCreateDialog(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <FolderPlus className="h-4 w-4" />
              <span>New Problem</span>
            </button>
            <button
              onClick={handleImport}
              className="btn-secondary flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>Import</span>
            </button>
            <button
              onClick={onClose}
              className="btn-secondary p-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="p-6 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Search problems..."
                className="input pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter style={{ color: 'var(--text-tertiary)' }} className="h-4 w-4" />
              <select
                className="input"
                value={filterTemplate}
                onChange={(e) => setFilterTemplate(e.target.value as any)}
              >
                <option value="all">All</option>
                <option value="problems">Problems</option>
                <option value="templates">Templates</option>
              </select>
            </div>
          </div>
        </div>

        {/* Problem List */}
        <div className="flex-1 overflow-auto p-6">
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
                            className="text-green-600 hover:text-green-700"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancelRename}
                            className="text-red-600 hover:text-red-700"
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
                    {problem.updatedAt !== problem.createdAt && (
                      <div>Updated: {formatDate(problem.updatedAt)}</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t">
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
                        className={`p-1 transition-colors ${
                          problem.isTemplate 
                            ? '' 
                            : ''
                        }`}
                        style={{ 
                          color: problem.isTemplate 
                            ? 'var(--color-warning-500)' 
                            : 'var(--text-tertiary)' 
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = problem.isTemplate 
                            ? 'var(--color-warning-600)' 
                            : 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = problem.isTemplate 
                            ? 'var(--color-warning-500)' 
                            : 'var(--text-tertiary)';
                        }}
                        title={problem.isTemplate ? "Remove from templates" : "Mark as template"}
                      >
                        {problem.isTemplate ? <Star className="h-4 w-4" /> : <StarOff className="h-4 w-4" />}
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
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-60">
          <div className="rounded-lg shadow-xl p-6 w-96 modal-content">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Create New Problem</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Problem Name</label>
                <input
                  type="text"
                  className="input w-full"
                  value={newProblemName}
                  onChange={(e) => setNewProblemName(e.target.value)}
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
                  className="rounded border-gray-300"
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <label htmlFor="isTemplate" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Mark as template
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewProblemName('');
                  setNewProblemIsTemplate(false);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProblem}
                disabled={!newProblemName.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-60">
          <div className="rounded-lg shadow-xl p-6 w-96 modal-content">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle 
                className="h-6 w-6" 
                style={{ color: 'var(--color-error-500)' }}
              />
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Delete Problem</h3>
            </div>
            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
              Are you sure you want to delete "{savedProblems[showDeleteConfirm]?.name}"? 
              This action cannot be undone and will delete all associated results.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-md transition-colors"
                style={{ 
                  backgroundColor: 'var(--color-error-600)',
                  color: 'var(--color-error-contrast)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-error-700)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-error-600)';
                }}
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