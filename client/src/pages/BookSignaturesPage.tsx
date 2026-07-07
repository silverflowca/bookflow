import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, PenLine } from 'lucide-react';
import SignatureStatusTab from '../components/signatures/SignatureStatusTab';

export default function BookSignaturesPage() {
  const { bookId } = useParams<{ bookId: string }>();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/edit/book/${bookId}/settings`} className="text-muted hover:text-theme transition-colors">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <div className="flex items-center gap-2">
          <PenLine className="h-6 w-6 text-accent" />
          <div>
            <h1 className="text-2xl font-bold text-theme">E-Signatures</h1>
            <p className="text-sm text-muted">Track signature requests and responses from readers.</p>
          </div>
        </div>
      </div>

      <div className="theme-section p-6">
        <p className="text-sm text-muted mb-6">
          Add a <strong>Signature</strong> component in the chapter editor to start collecting signatures.
          Results from all readers appear below, grouped by signature block.
        </p>
        {bookId && <SignatureStatusTab bookId={bookId} />}
      </div>
    </div>
  );
}
