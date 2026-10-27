// SPDX-License-Identifier: MPL-2.0
export function notifySubscribers(subscriptions: Map<number,Set<()=>void>>, id: number, report: (error: unknown)=>void) {
    const callbacks=subscriptions.get(id);
    subscriptions.delete(id);
    callbacks?.forEach(callback=>{try{callback();}catch(error){report(error);}});
}

export function warmInChunks<T>(items: T[], visit: (item:T)=>void, options: {
    schedule: (callback:()=>void)=>unknown; now: ()=>number; report: (error:unknown)=>void;
    budget?:number; batch?:number;
}): ()=>void {
    let index=0,cancelled=false;
    const budget=options.budget??6,batch=options.batch??100;
    function step(){
        if(cancelled)return;
        const start=options.now();let processed=0;
        while(index<items.length&&processed<batch&&(processed===0||options.now()-start<budget)){
            const item=items[index++];++processed;
            try{visit(item);}catch(error){options.report(error);}
        }
        if(index<items.length&&!cancelled)options.schedule(step);
    }
    options.schedule(step);
    return ()=>{cancelled=true;};
}
