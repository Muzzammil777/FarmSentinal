import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';

type AppImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fallbackLabel?: string;
};

export function AppImage({
  src,
  alt,
  className = '',
  style,
  fallbackLabel = 'Image unavailable',
  ...rest
}: AppImageProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={`relative flex min-h-48 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted/60 text-center ${className}`}
        style={style}
        role="img"
        aria-label={alt ?? fallbackLabel}
      >
        <div className="absolute inset-0 grid place-items-center px-6 py-8 text-muted-foreground">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-background/20 px-6 py-6 shadow-sm backdrop-blur-[1px]">
            <ImageOff className="h-10 w-10 shrink-0" />
            <div className="space-y-1 text-center">
              <p className="text-sm font-semibold leading-5 text-foreground">{alt ?? fallbackLabel}</p>
              <p className="text-xs leading-5 text-muted-foreground">The stream is unavailable right now.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      {...rest}
      onError={() => setHasError(true)}
    />
  );
}
