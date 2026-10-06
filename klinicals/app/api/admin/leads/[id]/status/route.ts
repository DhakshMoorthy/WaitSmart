import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
const statuses=['new','contacted','demo_scheduled','converted','closed'] as const
export async function POST(request:Request,{params}:{params:{id:string}}){const expected=process.env.ADMIN_DASHBOARD_TOKEN;if(!expected||cookies().get('klinicals_admin')?.value!==expected)return NextResponse.json({error:'Unauthorized'},{status:401});let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:'Invalid request'},{status:400})}const status=(body as {status?:string})?.status;if(!statuses.includes(status as typeof statuses[number]))return NextResponse.json({error:'Invalid status'},{status:400});const {error}=await supabaseAdmin().from('demo_leads').update({status}).eq('id',params.id);if(error)return NextResponse.json({error:'Could not update status'},{status:500});return NextResponse.json({ok:true})}
