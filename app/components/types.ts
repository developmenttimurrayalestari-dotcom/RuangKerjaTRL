export type Role = 'admin'|'manager'|'employee';
export interface Division {id:string;code:string;name:string;sortOrder:number;active:boolean;}
export interface WorkUnit {id:string;code:string;name:string;divisionId:string;sortOrder:number;active:boolean;}
export interface OrganizationAssignment {workUnitId:string|null;workUnitName:string|null;workUnitCode:string|null;divisionId:string|null;divisionName:string|null;}
export interface Permissions {manageAdministration:boolean;approveRequests:boolean;processPurchasing:boolean;viewTeam:boolean;}
export interface Employee extends OrganizationAssignment {id:string;nip:string;name:string;email:string;department:string;position:string;managerId:string|null;role:Role;workdays:string;active:boolean;joinDate:string;}
export interface Leave {id:string;number:string;employeeId:string;type:'annual'|'special';startDate:string;endDate:string;days:number;reason:string;status:string;approverId:string|null;createdAt:string;decisionNote?:string;details?:{date:string;chargeable:boolean;reason:string}[];}
export interface Balance {employeeId:string;year:number;entitlement:number;adjustment:number;used:number;reserved:number;available:number;}
export interface Item {id?:string;name:string;quantity:number;unit:string;unitPrice:number;}
export interface Purchase {id:string;number:string;employeeId:string;title:string;department:string;priority:'normal'|'urgent';neededBy:string;reason:string;items:Item[];total:number;status:string;createdAt:string;decisionNote?:string;approverId?:string|null;}
export interface Absence {id:string;employeeId:string;date:string;endDate?:string;type:'sick'|'unexcused';reason:string;}
export interface Holiday {id:string;date:string;name:string;kind:'national'|'collective';sourceUrl:string;year:number;}
export interface Settings {companyName:string;collectiveLeavePolicy:'exclude'|'deduct';defaultAnnualEntitlement:number;workdays:string;}
export interface WorkspaceState {viewer:OrganizationAssignment&{id:string;name:string;email:string;role:Role};divisions:Division[];workUnits:WorkUnit[];permissions:Permissions;employees:Employee[];leaveRequests:Leave[];balances:Balance[];absenceRecords:Absence[];purchaseRequests:Purchase[];holidays:Holiday[];calendarYears:{year:number;verified:boolean;sourceUrl:string}[];settings:Settings;auditLogs:{id:string;action:string;actorName:string;subject:string;createdAt:string}[];demo:boolean;approvalEvents?:{id:string;entityType:string;entityId:string;stage:string;decision:string;actorName:string;actorId:string;note:string;createdAt:string}[];}
export interface Preview {days:number;deductibleDays?:number;details:{date:string;chargeable:boolean;reason:string}[];yearBreakdown:Record<string,number>;}
export type Screen = 'overview'|'leave'|'approvals'|'purchases'|'employees'|'accounts'|'balances'|'attendance'|'calendar'|'reports'|'settings';
