import { ReactNode, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, BarChart3, Users,
  Settings as SettingsIcon, ClipboardList, LogOut, Store, Menu, Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Role = "admin" | "manager" | "cashier";

interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["admin", "manager"] },
  { title: "POS", url: "/pos", icon: ShoppingCart },
  { title: "Products", url: "/products", icon: Package, roles: ["admin", "manager"] },
  { title: "Sales", url: "/sales", icon: Receipt },
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ["admin", "manager"] },
  { title: "Shifts", url: "/shifts", icon: ClipboardList },
  { title: "Staff", url: "/staff", icon: Users, roles: ["admin"] },
  { title: "Settings", url: "/settings", icon: SettingsIcon, roles: ["admin"] },
];

// 5 most-used items for the mobile bottom nav
const BOTTOM_NAV_KEYS = ["Dashboard", "POS", "Products", "Sales", "Reports"];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
        <Store className="h-5 w-5" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-[15px] font-bold tracking-tight">Perepiri</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Food Mart</div>
        </div>
      )}
    </div>
  );
}

function SideNav({
  visible,
  onNavigate,
}: {
  visible: NavItem[];
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {visible.map((item) => (
        <NavLink
          key={item.title}
          to={item.url}
          end={item.url === "/"}
          onClick={onNavigate}
          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary"
          activeClassName="bg-gradient-to-r from-primary/15 to-primary/5 text-primary shadow-sm"
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          <span>{item.title}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function TopBar({
  visible,
  onOpenMobileNav,
}: {
  visible: NavItem[];
  onOpenMobileNav: () => void;
}) {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 glass-strong">
      <div className="container flex h-16 items-center gap-3 px-3 sm:px-6">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 lg:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Brand />

        {/* Desktop nav */}
        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {visible.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary"
              activeClassName="bg-primary/10 text-primary"
            >
              {item.title}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-10 gap-2 rounded-full pl-1 pr-3">
              <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                <AvatarFallback className="gradient-primary text-xs font-semibold text-primary-foreground">
                  {(user?.email ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[160px] truncate text-sm font-medium md:inline">
                {user?.email}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">
              Signed in as
              <div className="mt-0.5 truncate font-normal text-muted-foreground">{user?.email}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {roles.map((r) => (
                  <Badge key={r} variant="secondary" className="text-[10px] capitalize">{r}</Badge>
                ))}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/pos")}>
              <ShoppingCart className="mr-2 h-4 w-4" /> Open POS
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <SettingsIcon className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => { await signOut(); toast.success("Signed out"); }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function BottomNav({ visible }: { visible: NavItem[] }) {
  const location = useLocation();
  const items = BOTTOM_NAV_KEYS
    .map((key) => visible.find((v) => v.title === key))
    .filter(Boolean) as NavItem[];

  // Fallback for cashier-only roles: ensure POS + Sales + Shifts at minimum
  const safeItems = items.length >= 3
    ? items
    : visible.slice(0, 5);

  if (safeItems.length === 0) return null;

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 glass-strong lg:hidden safe-bottom"
    >
      <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${safeItems.length}, minmax(0, 1fr))` }}>
        {safeItems.map((item) => {
          const isActive =
            item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
          const Icon = item.title === "Dashboard" ? Home : item.icon;
          return (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              className="flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground tap-scale"
              activeClassName=""
            >
              <div
                className={cn(
                  "flex h-9 w-12 items-center justify-center rounded-full transition-all",
                  isActive && "gradient-primary text-primary-foreground shadow-glow"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <span className={cn(isActive && "text-primary")}>{item.title}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export function AppLayout({ children }: { children?: ReactNode }) {
  const { roles, user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visible = NAV.filter((i) => !i.roles || i.roles.some((r) => roles.includes(r)));

  return (
    <div className="flex min-h-screen w-full flex-col">
      <TopBar visible={visible} onOpenMobileNav={() => setMobileOpen(true)} />

      {/* Mobile slide-in drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] p-0 border-r-0">
          <SheetHeader className="border-b border-border/60 p-4 text-left">
            <SheetTitle className="flex items-center justify-between">
              <Brand />
            </SheetTitle>
          </SheetHeader>
          <SideNav visible={visible} onNavigate={() => setMobileOpen(false)} />
          <div className="border-t border-border/60 p-3">
            {user && (
              <div className="mb-2 rounded-xl bg-muted/60 p-3 text-xs">
                <div className="truncate font-semibold text-foreground">{user.email}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {roles.map((r) => (
                    <Badge key={r} variant="secondary" className="text-[10px] capitalize">{r}</Badge>
                  ))}
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={async () => {
                setMobileOpen(false);
                await signOut();
                toast.success("Signed out");
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <main className="flex-1 pb-nav lg:pb-0">
        {children ?? <Outlet />}
      </main>

      <BottomNav visible={visible} />
    </div>
  );
}
