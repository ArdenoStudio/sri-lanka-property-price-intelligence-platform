import { useCurrency } from '../hooks/useCurrency';
import { calculateEMI } from '../data/bankRates';

interface Props {
  priceLkr: number | null;
  listingType: string | null;
}

const DEFAULT_DOWN_PCT = 20;
const DEFAULT_RATE = 12.0;
const DEFAULT_TENURE = 20;

export function EMITeaser({ priceLkr, listingType }: Props) {
  if (!priceLkr || priceLkr <= 1_000_000 || listingType !== 'sale') return null;

  const { formatConverted } = useCurrency();
  const principal = priceLkr * (1 - DEFAULT_DOWN_PCT / 100);
  const emi = calculateEMI(principal, DEFAULT_RATE, DEFAULT_TENURE);

  return (
    <p className="text-[11px] text-[#525252] mb-2 num">
      ~{formatConverted(emi)}/mo
    </p>
  );
}
