import { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ListingDetail } from '../api';

interface Props {
  listing: ListingDetail;
}

function formatPrice(p: number | null | undefined): string {
  if (!p) return '';
  if (p >= 1_000_000) return `Rs ${(p / 1_000_000).toFixed(1)}M`;
  if (p >= 1_000) return `Rs ${(p / 1_000).toFixed(0)}K`;
  return `Rs ${p}`;
}

export function ShareButton({ listing }: Props) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/listing/${listing.id}`;
  const shareTitle = listing.title || `Property in ${listing.district}`;
  const shareText = [
    shareTitle,
    listing.price_lkr ? `— ${formatPrice(listing.price_lkr)}` : '',
    listing.district ? `in ${listing.district}` : '',
    listing.deal_score && listing.deal_score > 0
      ? `· ${listing.deal_score.toFixed(0)}% below market`
      : '',
    '| PropertyLK',
  ].filter(Boolean).join(' ');

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const nativeShare = () => {
    navigator.share?.({
      title: shareTitle,
      text: shareText,
      url: shareUrl,
    });
  };

  const whatsapp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const facebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const hasNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className="flex items-center gap-2">
      {/* Copy link */}
      <button
        onClick={copyLink}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[12px] text-[#a3a3a3] hover:text-white transition-all cursor-pointer"
        title="Copy link"
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5 text-emerald-400"
            >
              <Check className="w-3.5 h-3.5" />
              Copied!
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy link
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* WhatsApp */}
      <button
        onClick={whatsapp}
        className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-[#25D366]/[0.15] border border-white/[0.08] hover:border-[#25D366]/30 transition-all cursor-pointer"
        title="Share on WhatsApp"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#525252] hover:fill-[#25D366]" style={{ transition: 'fill 0.15s' }}>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </button>

      {/* Facebook */}
      <button
        onClick={facebook}
        className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-[#1877F2]/[0.15] border border-white/[0.08] hover:border-[#1877F2]/30 transition-all cursor-pointer"
        title="Share on Facebook"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#525252]" style={{ transition: 'fill 0.15s' }}>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </button>

      {/* Native share (mobile) */}
      {hasNativeShare && (
        <button
          onClick={nativeShare}
          className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-[#14b8a6]/[0.15] border border-white/[0.08] hover:border-[#14b8a6]/30 transition-all cursor-pointer"
          title="Share"
        >
          <Share2 className="w-3.5 h-3.5 text-[#525252]" />
        </button>
      )}
    </div>
  );
}
