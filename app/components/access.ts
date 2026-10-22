import type {Leave,Purchase,Screen,WorkspaceState} from './types';

const administrationScreens:Screen[]=['employees','accounts','balances','attendance','reports','settings'];

export function canApproveRequests(data:WorkspaceState){
  return data.permissions.approveRequests&&(data.viewer.role==='admin'||data.viewer.role==='manager');
}

export function canOpenScreen(data:WorkspaceState|null,screen:Screen){
  if(administrationScreens.includes(screen))return data?.viewer.role==='admin'&&!!data.permissions?.manageAdministration;
  if(screen==='approvals')return !!data&&canApproveRequests(data);
  return true;
}

export function canApproveLeave(data:WorkspaceState,request:Leave){
  return canApproveRequests(data)&&request.status==='pending'&&request.employeeId!==data.viewer.id&&
    (data.viewer.role==='admin'||request.approverId===data.viewer.id);
}

export function canProcessPurchase(data:WorkspaceState,request:Purchase){
  return data.permissions.processPurchasing&&request.employeeId!==data.viewer.id&&
    (data.viewer.role==='admin'||(data.viewer.role==='manager'&&data.viewer.workUnitCode==='PURCHASING'))&&
    ['pending_purchasing','approved','ordered'].includes(request.status);
}

export function canApprovePurchase(data:WorkspaceState,request:Purchase){
  if(!canApproveRequests(data)||request.employeeId===data.viewer.id)return false;
  if(request.status==='pending_purchasing')return canProcessPurchase(data,request);
  if(request.status!=='pending_manager')return false;
  return data.viewer.role==='admin'||request.approverId===data.viewer.id;
}
