import { DEFAULT_PRODUCT_IMAGE, getImageUrl } from "../api/client";
import type { Product } from "../types";

interface ProductGridProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

export function ProductGrid({ products, onSelectProduct }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-16">
        <span className="text-4xl mb-3">🍽️</span>
        <p className="text-sm font-medium">Страви не знайдені</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5 overflow-y-auto pr-1 pb-4">
      {products.map((product) => {
        // Найнижча ціна для бейджа
        const minPrice =
          product.variants.length > 0
            ? Math.min(...product.variants.map((v) => v.price))
            : 0;

        return (
          <button
            key={product.id}
            type="button"
            onClick={() => onSelectProduct(product)}
            className="group relative bg-[#13171F] hover:bg-[#1A202C] border border-white/5 hover:border-amber-500/40 rounded-2xl p-2.5 sm:p-3 flex flex-col text-left transition-all duration-150 cursor-pointer active:scale-98 shadow hover:shadow-lg hover:shadow-amber-500/5"
          >
            {/* Image / Thumbnail */}
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black/40 mb-2.5">
              <img
                src={getImageUrl(product.image_url)}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                }}
              />

              {/* Variants badge */}
              {product.variants.length > 1 && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold text-amber-300 border border-white/10">
                  {product.variants.length} розм.
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-sm font-bold text-zinc-100 group-hover:text-amber-400 line-clamp-2 transition-colors mb-1 leading-snug">
              {product.name}
            </h3>

            {/* Description snippet */}
            {product.description && (
              <p className="text-[11px] text-zinc-400 line-clamp-1 mb-2">
                {product.description}
              </p>
            )}

            {/* Price badge */}
            <div className="mt-auto pt-1 flex items-center justify-between">
              <span className="text-sm font-extrabold text-white">
                {product.variants.length > 1 ? `від ${minPrice} ₴` : `${minPrice} ₴`}
              </span>
              <span className="w-7 h-7 rounded-lg bg-amber-500/10 group-hover:bg-amber-500 text-amber-400 group-hover:text-black flex items-center justify-center text-base font-bold transition-all">
                +
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
