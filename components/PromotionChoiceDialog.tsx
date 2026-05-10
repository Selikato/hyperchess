import type { PromotionPiece } from "@/lib/chess/promotion";

const PROMOTION_OPTIONS: Array<{ piece: PromotionPiece; label: string; symbol: string }> = [
  { piece: "q", label: "Vezir", symbol: "♛" },
  { piece: "r", label: "Kale", symbol: "♜" },
  { piece: "b", label: "Fil", symbol: "♝" },
  { piece: "n", label: "At", symbol: "♞" },
];

export function PromotionChoiceDialog({
  onSelect,
  onCancel,
}: {
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-xs rounded-xl border border-[#3c3b36] bg-[#201f1b] p-4 shadow-2xl">
        <p className="text-center text-sm font-semibold text-white">
          Piyon neye dönüşsün?
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {PROMOTION_OPTIONS.map((option) => (
            <button
              key={option.piece}
              type="button"
              onClick={() => onSelect(option.piece)}
              className="rounded-lg border border-[#3c3b36] bg-[#2a2926] px-2 py-2 text-center text-[#e8e6e3] transition hover:border-[#81b64c] hover:bg-[#2f3926] active:scale-95"
            >
              <span className="block text-2xl leading-none">{option.symbol}</span>
              <span className="mt-1 block text-[11px] font-semibold">{option.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full rounded-md border border-[#3c3b36] px-3 py-2 text-xs font-semibold text-[#c8c6c2] hover:bg-[#2a2926]"
        >
          İptal
        </button>
      </div>
    </div>
  );
}
