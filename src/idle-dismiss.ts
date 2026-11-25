/** Passive, scoped activity tracking. One timeout; a held gesture never expires. */
export class IdleDismiss {
  private timer?:ReturnType<typeof setTimeout>;
  private pointers=new Set<number>();
  private touches=new Set<number>();
  private keys=new Set<string>();
  private removers:Array<()=>void>=[];
  constructor(private host:HTMLElement,private seconds:()=>number,private dismiss:()=>void){
    const listen=(target:EventTarget,type:string,callback:EventListener)=>{
      target.addEventListener(type,callback,{capture:true,passive:true});
      this.removers.push(()=>target.removeEventListener(type,callback,true));
    };
    const doc=host.ownerDocument,inScope=(event:Event)=>event.composedPath().includes(host);
    listen(doc,'pointerdown',((e:PointerEvent)=>{if(inScope(e)){this.pointers.add(e.pointerId);this.reset();}}) as EventListener);
    for(const type of ['pointerup','pointercancel'])listen(doc,type,((e:PointerEvent)=>{if(this.pointers.delete(e.pointerId))this.reset();}) as EventListener);
    listen(doc,'touchstart',((e:TouchEvent)=>{if(inScope(e)){for(const t of Array.from(e.changedTouches))this.touches.add(t.identifier);this.reset();}}) as EventListener);
    for(const type of ['touchend','touchcancel'])listen(doc,type,((e:TouchEvent)=>{let tracked=false;for(const t of Array.from(e.changedTouches))tracked=this.touches.delete(t.identifier)||tracked;if(tracked)this.reset();}) as EventListener);
    listen(doc,'keydown',((e:KeyboardEvent)=>{if(inScope(e)){this.keys.add(e.code||e.key);this.reset();}}) as EventListener);
    listen(doc,'keyup',((e:KeyboardEvent)=>{if(this.keys.delete(e.code||e.key))this.reset();}) as EventListener);
    for(const type of ['click','input','change','wheel','scroll'])listen(doc,type,((e:Event)=>{if(inScope(e))this.reset();}) as EventListener);
    listen(doc,'visibilitychange',()=>{this.clearHeld();this.reset();});
    if(doc.defaultView)listen(doc.defaultView,'blur',()=>{this.clearHeld();this.reset();});
    this.reset();
  }
  private clearHeld(){this.pointers.clear();this.touches.clear();this.keys.clear();}
  reset(){
    clearTimeout(this.timer);this.timer=undefined;
    const seconds=this.seconds();
    if(!Number.isFinite(seconds)||seconds<=0||this.pointers.size||this.touches.size||this.keys.size)return;
    this.timer=setTimeout(()=>{this.timer=undefined;if(this.host.isConnected)this.dismiss();},seconds*1000);
  }
  destroy(){clearTimeout(this.timer);this.timer=undefined;for(const remove of this.removers.splice(0))remove();this.clearHeld();}
}
