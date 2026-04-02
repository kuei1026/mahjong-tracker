export function formatTile(tile: string | null): string {
  if (!tile) return '';

  const suit = tile[0]; // m / p / s / z
  const num = tile.slice(1);

  const suitMap: Record<string, string> = {
    m: '萬',
    p: '筒',
    s: '索',
    z: '', // 字牌之後再擴充
  };

  return `${num}${suitMap[suit] || ''}`;
}