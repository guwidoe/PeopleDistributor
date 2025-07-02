import React from 'react';
import { Link } from 'react-router-dom';
import { HeaderThemeToggle } from './ThemeToggle';
import { Users, Shuffle, Settings, Zap, Target, Clock, CheckCircle, ArrowRight, Star, Globe, Lightbulb } from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <header className="relative bg-secondary">
        <div className="absolute top-4 right-4 z-10">
          <HeaderThemeToggle />
        </div>
        
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 min-h-screen">
          <div className="max-w-4xl w-full text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-primary mb-4">
              Group Mixer
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-secondary mb-8">
              The intelligent scheduler for creating optimal group assignments and maximizing meaningful connections.
            </p>

            <div className="card p-6 sm:p-8 md:p-10 mb-8 text-left">
              <h2 className="text-2xl sm:text-3xl font-semibold text-primary mb-4 text-center">
                Automate Your Group Scheduling
              </h2>
              <p className="text-secondary mb-6 text-center">
                Group Mixer is a powerful optimization tool for anyone who runs workshops, conferences, team-building events, or social mixers. 
                If you need to split people into smaller groups, especially over multiple sessions, this tool will save you hours of manual effort and complex spreadsheet juggling.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-secondary p-4 rounded-lg">
                  <div className="flex items-center mb-3">
                    <Target className="w-6 h-6 text-accent mr-2" />
                    <h3 className="text-xl font-semibold text-primary">Maximize Connections</h3>
                  </div>
                  <p className="text-secondary">
                    Generate schedules that maximize unique interactions. Ensure participants meet as many new people as possible, 
                    preventing stale groups and encouraging networking.
                  </p>
                </div>
                <div className="bg-secondary p-4 rounded-lg">
                  <div className="flex items-center mb-3">
                    <Settings className="w-6 h-6 text-accent mr-2" />
                    <h3 className="text-xl font-semibold text-primary">Handle Complex Constraints</h3>
                  </div>
                  <p className="text-secondary">
                    Keep certain people together or apart, balance groups by attributes like skill or department, 
                    and handle late arrivals or early departures with ease.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center mb-12">
              <Link to="/app">
                <button className="btn-primary text-xl sm:text-2xl px-8 sm:px-12 py-3 sm:py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 inline-flex items-center gap-2">
                  Get Started <ArrowRight className="w-6 h-6" />
                </button>
              </Link>
              <p className="text-tertiary text-sm mt-2">Free to use • No signup required • Works in your browser</p>
            </div>
          </div>
        </section>
      </header>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 md:px-8 bg-primary">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-secondary mb-4">
            Powerful Features for Every Use Case
          </h2>
          <p className="text-xl text-tertiary text-center mb-12 max-w-3xl mx-auto">
            From simple team rotations to complex multi-session conferences with hundreds of participants, 
            Group Mixer handles it all with advanced optimization algorithms.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="card p-6">
              <div className="flex items-center mb-4">
                <Shuffle className="w-8 h-8 text-accent mr-3" />
                <h3 className="text-xl font-semibold text-primary">Smart Optimization</h3>
              </div>
              <p className="text-secondary">
                Uses advanced simulated annealing algorithms to find optimal group assignments. 
                Maximizes unique person-to-person interactions while respecting all your constraints.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center mb-4">
                <Users className="w-8 h-8 text-accent mr-3" />
                <h3 className="text-xl font-semibold text-primary">Flexible Constraints</h3>
              </div>
              <p className="text-secondary">
                Set up complex rules: keep teams together, prevent conflicts, balance attributes, 
                fix certain people to specific groups, and handle partial participation.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center mb-4">
                <Clock className="w-8 h-8 text-accent mr-3" />
                <h3 className="text-xl font-semibold text-primary">Multi-Session Support</h3>
              </div>
              <p className="text-secondary">
                Perfect for conferences, workshops, or events spanning multiple time slots. 
                Ensures variety across sessions while maintaining group size limits.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center mb-4">
                <Zap className="w-8 h-8 text-accent mr-3" />
                <h3 className="text-xl font-semibold text-primary">Fast & Efficient</h3>
              </div>
              <p className="text-secondary">
                Built with Rust and WebAssembly for maximum performance. 
                Handles hundreds of participants and complex constraints in seconds.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center mb-4">
                <Globe className="w-8 h-8 text-accent mr-3" />
                <h3 className="text-xl font-semibold text-primary">No Installation Required</h3>
              </div>
              <p className="text-secondary">
                Runs entirely in your browser with no data sent to servers. 
                Your participant information stays completely private and secure.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center mb-4">
                <CheckCircle className="w-8 h-8 text-accent mr-3" />
                <h3 className="text-xl font-semibold text-primary">Export & Share</h3>
              </div>
              <p className="text-secondary">
                Export your optimized schedules to CSV or JSON formats. 
                Save and load problem configurations for repeated use.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-16 px-4 sm:px-6 md:px-8 bg-secondary">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-primary mb-4">
            Perfect for Any Group-Based Event
          </h2>
          <p className="text-xl text-secondary text-center mb-12 max-w-3xl mx-auto">
            Whether you're organizing a small workshop or a large conference, Group Mixer adapts to your needs.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="card p-8">
              <h3 className="text-2xl font-semibold text-primary mb-4">Conferences & Workshops</h3>
              <ul className="space-y-3 text-secondary">
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Breakout sessions with rotating groups</span>
                </li>
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Networking mixers and speed networking</span>
                </li>
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Workshop rotations with skill-based grouping</span>
                </li>
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Panel discussions with diverse representation</span>
                </li>
              </ul>
            </div>

            <div className="card p-8">
              <h3 className="text-2xl font-semibold text-primary mb-4">Team Building & Training</h3>
              <ul className="space-y-3 text-secondary">
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Cross-departmental collaboration sessions</span>
                </li>
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Training groups with balanced skill levels</span>
                </li>
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Mentorship program pairings</span>
                </li>
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Project team formations</span>
                </li>
              </ul>
            </div>

            <div className="card p-8">
              <h3 className="text-2xl font-semibold text-primary mb-4">Educational Settings</h3>
              <ul className="space-y-3 text-secondary">
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Student group projects and rotations</span>
                </li>
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Peer learning circles</span>
                </li>
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Lab partnerships and study groups</span>
                </li>
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Classroom discussion groups</span>
                </li>
              </ul>
            </div>

            <div className="card p-8">
              <h3 className="text-2xl font-semibold text-primary mb-4">Social & Community Events</h3>
              <ul className="space-y-3 text-secondary">
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Speed dating and social mixers</span>
                </li>
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Tournament brackets and game groups</span>
                </li>
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Community volunteer assignments</span>
                </li>
                <li className="flex items-start">
                  <Star className="w-5 h-5 text-accent mr-2 mt-0.5 flex-shrink-0" />
                  <span>Interest-based meetup groups</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Details Section */}
      <section className="py-16 px-4 sm:px-6 md:px-8 bg-primary">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-secondary mb-4">
            Built with Advanced Technology
          </h2>
          <p className="text-xl text-tertiary text-center mb-12 max-w-3xl mx-auto">
            Group Mixer leverages cutting-edge optimization algorithms and modern web technologies 
            to deliver fast, reliable results for even the most complex scheduling challenges.
          </p>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="card p-8">
              <div className="flex items-center mb-6">
                <Lightbulb className="w-8 h-8 text-accent mr-3" />
                <h3 className="text-2xl font-semibold text-primary">The Social Golfer Problem</h3>
              </div>
              <p className="text-secondary mb-4">
                Group Mixer solves a classic problem in combinatorial optimization known as the "Social Golfer Problem." 
                This involves arranging people into groups across multiple sessions to maximize unique pairings.
              </p>
              <p className="text-secondary">
                Our implementation extends this concept with additional constraints like attribute balancing, 
                fixed assignments, and partial participation - making it practical for real-world scenarios.
              </p>
            </div>

            <div className="card p-8">
              <div className="flex items-center mb-6">
                <Zap className="w-8 h-8 text-accent mr-3" />
                <h3 className="text-2xl font-semibold text-primary">Optimization Engine</h3>
              </div>
              <p className="text-secondary mb-4">
                Built with Rust for maximum performance and compiled to WebAssembly for browser compatibility. 
                Uses simulated annealing with configurable parameters to find near-optimal solutions.
              </p>
              <p className="text-secondary">
                The solver evaluates millions of possible arrangements per second, balancing multiple objectives 
                and constraints to deliver the best possible group assignments.
              </p>
            </div>
          </div>

          <div className="mt-12 card p-8 text-center">
            <h3 className="text-2xl font-semibold text-primary mb-4">Open Source & Privacy-First</h3>
            <p className="text-secondary mb-6 max-w-3xl mx-auto">
              Group Mixer is completely open source and runs entirely in your browser. 
              No data is sent to our servers - your participant information and group assignments remain completely private. 
              The entire optimization process happens locally on your device.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-tertiary">
              <span className="bg-secondary px-3 py-1 rounded-full">Rust + WebAssembly</span>
              <span className="bg-secondary px-3 py-1 rounded-full">React + TypeScript</span>
              <span className="bg-secondary px-3 py-1 rounded-full">Local Processing</span>
              <span className="bg-secondary px-3 py-1 rounded-full">No Data Collection</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 md:px-8 bg-secondary">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary mb-4">
            Ready to Optimize Your Group Scheduling?
          </h2>
          <p className="text-xl text-secondary mb-8 max-w-2xl mx-auto">
            Join thousands of event organizers, educators, and team leaders who trust Group Mixer 
            to create better group experiences.
          </p>
          
          <Link to="/app">
            <button className="btn-primary text-xl sm:text-2xl px-8 sm:px-12 py-3 sm:py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 inline-flex items-center gap-2 mb-4">
              Start Optimizing Now <ArrowRight className="w-6 h-6" />
            </button>
          </Link>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm text-tertiary mt-8">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-accent" />
              <span>Free forever</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-accent" />
              <span>No registration required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-accent" />
              <span>Works offline</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-accent" />
              <span>Privacy-first</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 md:px-8 bg-primary border-t border-tertiary">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-tertiary text-sm mb-2">
            Built to solve the Social Golfer Problem and similar combinatorial optimization challenges in event scheduling.
          </p>
          <p className="text-tertiary text-xs">
            © 2025 Guido Witt-Dörring
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage; 