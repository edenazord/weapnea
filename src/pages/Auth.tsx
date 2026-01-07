
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import LoginForm from "@/components/auth/LoginForm"
import RegisterForm from "@/components/auth/RegisterForm"
import { Link, useSearchParams } from "react-router-dom"
import { Waves, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/LanguageContext"

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('view') || 'login';
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 p-4">
       <Link to="/" className="flex items-center space-x-3 mb-8 no-underline">
        <img src="/images/weapnea-logo.png" alt="WeApnea Logo" className="h-14 w-14" />
        <span className="text-4xl font-bold text-blue-900">WeApnea</span>
      </Link>
      <Tabs defaultValue={defaultTab} className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">{t('common.login', 'Accedi')}</TabsTrigger>
          <TabsTrigger value="register">{t('common.register', 'Registrati')}</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>{t('auth.login_title', 'Bentornato su WeApnea')}</CardTitle>
              <CardDescription>
                {t('auth.login_subtitle', 'Inserisci le tue credenziali per accedere al tuo account.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>{t('auth.register_title', 'Crea un account WeApnea')}</CardTitle>
              <CardDescription>
                {t('auth.register_subtitle', 'Unisciti alla community di WeApnea.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RegisterForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Button variant="link" asChild className="mt-8 text-gray-700 hover:text-blue-700">
        <Link to="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('auth.back_home', 'Torna alla Homepage')}
        </Link>
      </Button>
    </div>
  )
}
export default AuthPage;
