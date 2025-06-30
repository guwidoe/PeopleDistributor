import { Users, Zap } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                PeopleDistributor
              </h1>
            </div>
            <div className="hidden md:flex items-center space-x-2 text-sm text-gray-500">
              <Zap className="h-4 w-4" />
              <span>Powered by Rust + WASM</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-success-500 rounded-full"></div>
              <span>Ready</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
} 