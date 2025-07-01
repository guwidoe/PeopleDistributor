import React from 'react';
import { Link } from 'react-router-dom';
import { HeaderThemeToggle } from './ThemeToggle';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-secondary flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 relative">
      <div className="absolute top-4 right-4">
        <HeaderThemeToggle />
      </div>
      <div className="max-w-4xl w-full text-center">
        
        <header className="mb-8">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-primary mb-2">
            Group Mixer
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-secondary">
            The intelligent scheduler for creating optimal group assignments.
          </p>
        </header>

        <div className="card p-6 sm:p-8 md:p-10 mb-8 text-left">
          <h2 className="text-2xl sm:text-3xl font-semibold text-primary mb-4">
            Automate Your Group Scheduling
          </h2>
          <p className="text-secondary mb-6">
            Group Mixer is a powerful solver for anyone who runs workshops, conferences, team-building events, or social mixers. If you need to split people into smaller groups, especially over multiple sessions, this tool will save you hours of manual effort and complex spreadsheet juggling.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-secondary p-4 rounded-lg">
              <h3 className="text-xl font-semibold text-primary mb-2">Maximize Connections</h3>
              <p className="text-secondary">
                The core feature is generating schedules that maximize the number of unique interactions. It ensures participants meet as many new people as possible, preventing stale groups and encouraging networking.
              </p>
            </div>
            <div className="bg-secondary p-4 rounded-lg">
              <h3 className="text-xl font-semibold text-primary mb-2">Handle Complex Constraints</h3>
              <p className="text-secondary">
                Need to keep certain people together or apart? Want to balance groups based on skill, department, or any other attribute? Group Mixer handles these rules with ease, even for single-session assignments.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link to="/app">
            <button className="btn-primary text-xl sm:text-2xl px-8 sm:px-12 py-3 sm:py-4 rounded-full shadow-lg hover:shadow-xl transition-shadow duration-300">
              Get Started
            </button>
          </Link>
        </div>

        <footer className="mt-12 text-tertiary text-sm">
          <p>
            This tool is designed to solve the "Social Golfer Problem" and similar combinatorial optimization challenges in event scheduling.
          </p>
        </footer>

      </div>
    </div>
  );
};

export default LandingPage; 