import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Users, MessageSquare, Sparkles } from 'lucide-react';
import api from '../lib/api';
import type { Book } from '../types';

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBooks();
  }, []);

  async function loadBooks() {
    try {
      const response = await api.getBooks({ visibility: 'public', status: 'published' });
      setBooks(response.data || []);
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Interactive Books, Engaged Readers
            </h1>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              Create multi-chapter books with embedded questions, polls, highlights, notes, and media.
              Let your readers engage deeply with your content.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                to="/register"
                className="bg-white text-primary-600 hover:bg-primary-50 px-6 py-3 rounded-lg font-semibold"
              >
                Start Writing
              </Link>
              <Link
                to="/dashboard"
                className="border-2 border-white text-white hover:bg-white/10 px-6 py-3 rounded-lg font-semibold"
              >
                Browse Books
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything You Need to Create Interactive Books
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<MessageSquare className="h-8 w-8" />}
              title="Inline Questions"
              description="Embed questions and quizzes directly in your text at any position."
            />
            <FeatureCard
              icon={<Users className="h-8 w-8" />}
              title="Polls & Discussions"
              description="Create polls to engage readers and spark discussions."
            />
            <FeatureCard
              icon={<Sparkles className="h-8 w-8" />}
              title="Rich Annotations"
              description="Add highlights, notes, and external links throughout your book."
            />
            <FeatureCard
              icon={<BookOpen className="h-8 w-8" />}
              title="Audio & Video"
              description="Link audio and video clips to specific paragraphs."
            />
          </div>
        </div>
      </section>

      {/* Published Books Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">
            Explore Published Books
          </h2>

          {loading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : books.length === 0 ? (
            <div className="text-center text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No published books yet. Be the first to create one!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center p-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-600 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  return (
    <Link to={`/book/${book.id}`} className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-[3/4] bg-gradient-to-br from-primary-100 to-primary-200 rounded-t-lg flex items-center justify-center">
        {book.cover_image_url ? (
          <img
            src={book.cover_image_url}
            alt={book.title}
            className="w-full h-full object-cover rounded-t-lg"
          />
        ) : (
          <BookOpen className="h-16 w-16 text-primary-400" />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-1 line-clamp-2">{book.title}</h3>
        {book.subtitle && (
          <p className="text-sm text-gray-500 mb-2 line-clamp-1">{book.subtitle}</p>
        )}
        <p className="text-sm text-gray-600">
          by {book.author?.display_name || 'Unknown Author'}
        </p>
        {book.chapters && (
          <p className="text-xs text-gray-400 mt-2">
            {book.chapters.length} chapters
          </p>
        )}
      </div>
    </Link>
  );
}
