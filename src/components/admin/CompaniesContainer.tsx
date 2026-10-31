"use client";
import { getCompanyById } from "@/actions/company.actions";
import type { Company } from "@/models/job.model";
import { useState } from "react";
import Loading from "../Loading";
import { RecordsCount } from "../RecordsCount";
import { ResponsiveCardHeader } from "../ResponsiveCardHeader";
import { SearchInput } from "../SearchInput";
import { Card,CardContent,CardTitle } from "../ui/card";
import AddCompany from "./AddCompany";
import { useCompaniesList } from "./companies-container/useCompaniesList";
import CompaniesTable from "./CompaniesTable";
export default function CompaniesContainer() {
 const [searchTerm,setSearchTerm]=useState("");
 const [dialogOpen,setDialogOpen]=useState(false);
 const [editCompany,setEditCompany]=useState<Company | null>(null);
 const list=useCompaniesList("mine",searchTerm,true);
 const edit=async (id:string)=>{setEditCompany(await getCompanyById(id));setDialogOpen(true);};
 return <div className="col-span-3"><Card><ResponsiveCardHeader><div className="flex items-baseline gap-2"><CardTitle>Companies</CardTitle><RecordsCount count={list.companies.length} total={list.total} label="companies" /></div><AddCompany dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} editCompany={editCompany} resetEditCompany={()=>setEditCompany(null)} reloadCompanies={list.reload} /></ResponsiveCardHeader><CardContent><SearchInput value={searchTerm} placeholder="Search companies..." onChange={setSearchTerm} />{list.initialLoading ? <Loading /> : <CompaniesTable companies={list.companies} editCompany={edit} reloadCompanies={list.reload} />}<div ref={list.sentinelRef} />{list.loadingMore && <Loading />}</CardContent></Card></div>;
}
