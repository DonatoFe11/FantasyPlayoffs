import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

export function getPlayerLastName(fullName) {
  if (!fullName) return "";
  const parts = fullName.split(" ");
  if (parts.length === 1) return parts[0].toUpperCase();
  
  let lastName = parts[parts.length - 1].toUpperCase();
  const suffixes = ["JR.", "JR", "SR.", "SR", "II", "III", "IV"];
  
  if (suffixes.includes(lastName) && parts.length > 1) {
    lastName = `${parts[parts.length - 2].toUpperCase()} ${lastName}`;
  }
  
  return lastName;
}
