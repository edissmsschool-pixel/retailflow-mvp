import { ReactNode } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, BarChart3, Users,
  Settings as SettingsIcon, ClipboardList, LogOut, Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface NavItem { title: string; url: string; icon: typeof LayoutDashboard; roles?: ("admin" | "manager" | "cashier")[]; }

const items: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["admin", "manager"] },
  { title: "Point of Sale", url: "/pos", icon: ShoppingCart },
  { title: "Products", url: "/products", icon: Package, roles: ["admin", "manager"] },
  { title: "Sales", url: "/sales", icon: Receipt },
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ["admin", "manager"] },
  { title: "Shifts", url: "/shifts", icon: ClipboardList },
  { title: "Staff", url: "/staff", icon: Users, roles: ["admin"] },
  { title: "Settings", url: "/settings", icon: SettingsIcon, roles: ["admin"] },
];

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { roles, user, signOut } = useAuth();

  const visible = items.filter((i) => !i.roles || i.roles.some((r) => roles.includes(r)));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2 px-3 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md gradient-primary text-primary-foreground">
            <Store className="h-4 w-4" />
          </div>
          {!collapsed && <span className="font-display text-base font-bold tracking-tight text-sidebar-foreground">Retail POS</span>}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="mt-auto p-2">
          {!collapsed && user && (
            <div className="rounded-md bg-sidebar-accent/40 p-2 text-xs text-sidebar-foreground/80">
              <div className="truncate font-medium text-sidebar-foreground">{user.email}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {roles.map((r) => <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>)}
              </div>
            </div>
          )}
          <Button variant="ghost" className="mt-2 w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={async () => { await signOut(); toast.success("Signed out"); }}>
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign out</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export function AppLayout({ children }: { children?: ReactNode }) {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/80 px-3 backdrop-blur">
            <SidebarTrigger />
            <div className="flex-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-7 w-7"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{(user?.email ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  <span className="hidden text-sm sm:inline">{user?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs">
                  Signed in as
                  <div className="font-normal text-muted-foreground">{user?.email}</div>
                  <div className="mt-1 flex gap-1">{roles.map((r) => <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>)}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/pos")}>Open POS</DropdownMenuItem>
                <DropdownMenuItem onClick={async () => { await signOut(); toast.success("Signed out"); }}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 overflow-auto">
            {children ?? <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
