export const nearBottom = (top: number, height: number, viewport: number) => height - viewport - top <= 64;
export class ScrollMemory {
  private positions = new Map<string, { top: number; follow: boolean }>();
  read(key: string) { return this.positions.get(key) || { top: 0, follow: true }; }
  save(key: string, top: number, height: number, viewport: number) { this.positions.set(key, { top, follow: nearBottom(top,height,viewport) }); }
  pause(key: string, top: number) { this.positions.set(key,{top,follow:false}); }
  bottom(key: string) { this.positions.set(key,{top:0,follow:true}); }
}
