
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import { useLanguage } from "@/contexts/LanguageContext"

export function UserNav() {
  const { user, profile, logout } = useAuth()
  const effective = profile ?? user
  const navigate = useNavigate()
  const { t } = useLanguage()

  const handleLogout = async () => {
    await logout()
    navigate("/")
  }

  // Don't render if user is not authenticated
  if (!effective || !effective.is_active) {
    console.log('UserNav: User not authenticated', {
      hasUser: !!user,
      hasProfile: !!profile,
      isActive: user?.is_active
    });
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="rounded-full pl-2 pr-3 h-9 flex items-center gap-2 border-purple-200 hover:border-purple-400">
          <Avatar className="h-6 w-6">
            <AvatarImage src={effective.avatar_url || undefined} alt={effective.full_name || effective.email} />
            <AvatarFallback>{effective.full_name?.charAt(0).toUpperCase() || effective.email?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{t('nav.personal_area', 'Area Personale')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {effective.full_name || effective.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {effective.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => navigate('/profile')}>
            {t('nav.profile', 'Profilo')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          {t('nav.logout', 'Esci')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
