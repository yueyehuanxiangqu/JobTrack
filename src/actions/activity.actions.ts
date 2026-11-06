// The legacy ActivityType table now supplies Task categories.
// Its database identity stays unchanged for existing records and ZIP backups.
export { getAllActivityTypes, createActivityType, getActivityTypeList, deleteActivityTypeById } from "./activity/activityTypes";
