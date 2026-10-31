// Barrel for the company server actions, split into src/actions/company/.
// Each module below carries its own "use server"; this file only re-exports so
// the long-standing "@/actions/company.actions" import path keeps working.

export {
getAllCompanies,
getCompanyById,
getCompanyDetails,getCompanyList
} from "./company/queries";

export {
addCompany,deleteCompanyById,updateCompany
} from "./company/mutations";
