"""VisionCraft 3D Printing Pricing Engine.

Currently configured with the standard hardcoded rate: 25 LKR per 1 gram.
Designed with a modular hook to integrate multi-variable equations (combining print duration)
as soon as provided.
"""
from decimal import Decimal, ROUND_HALF_UP

DEFAULT_RATE_PER_GRAM_LKR = Decimal("25.00")


def calculate_fdm_price(
    filament_grams: Decimal,
    duration_seconds: int,
    rate_per_gram: Decimal = DEFAULT_RATE_PER_GRAM_LKR,
) -> dict:
    """
    Calculate FDM 3D printing price.
    Currently: Price = Grams * 25 LKR
    """
    grams = filament_grams.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    rate = rate_per_gram.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    # Baseline: 25 LKR per gram
    raw_price = grams * rate
    final_price = raw_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Format duration
    hours = duration_seconds // 3600
    minutes = (duration_seconds % 3600) // 60
    seconds = duration_seconds % 60
    duration_str = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m {seconds}s"

    return {
        "calculated_price_lkr": float(final_price),
        "rate_per_gram_lkr": float(rate),
        "filament_grams": float(grams),
        "duration_seconds": duration_seconds,
        "duration_formatted": duration_str,
        "formula_applied": f"{grams}g × {rate} LKR/g",
        "method": "HARDCODED_GRAM_RATE",
    }
