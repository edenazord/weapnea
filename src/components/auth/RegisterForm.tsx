
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

const RegisterForm = () => {
  const { t } = useLanguage();
  // Nuovo schema semplificato: tutti si registrano come utenti "final_user"
  const formSchema = z.object({
    full_name: z.string().min(2, { message: t('auth.register.validation.fullname_required', 'Il nome completo è obbligatorio') }),
    email: z.string().email({ message: t('auth.register.validation.email_invalid', 'Indirizzo email non valido.') }),
    password: z.string().min(6, { message: t('auth.register.validation.password_min', 'La password deve contenere almeno 6 caratteri.') }),
  });
  
  // Vecchio schema con scelta ruolo e campi sponsor mantenuto per futuro riutilizzo
  // const formSchema = z.object({
  //   role: z.enum(["final_user", "instructor", "company"], {
  //     required_error: t('auth.register.validation.role_required', 'Devi selezionare un tipo di account.'),
  //   }),
  //   full_name: z.string().min(2, { message: t('auth.register.validation.fullname_required', 'Il nome completo è obbligatorio') }),
  //   email: z.string().email({ message: t('auth.register.validation.email_invalid', 'Indirizzo email non valido.') }),
  //   password: z.string().min(6, { message: t('auth.register.validation.password_min', 'La password deve contenere almeno 6 caratteri.') }),
  //   company_name: z.string().optional(),
  //   vat_number: z.string().optional(),
  //   company_address: z.string().optional(),
  // }).refine(data => {
  //   if (data.role === 'company') {
  //     return !!data.company_name && !!data.vat_number && !!data.company_address;
  //   }
  //   return true;
  // }, {
  //   message: t('auth.register.validation.company_required', "Tutti i campi sponsor sono obbligatori se il ruolo è 'Sponsor'."),
  //   path: ['company_name'],
  // });

  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      // role: "final_user", // non più richiesto
      full_name: "",
      email: "",
      password: "",
    },
  });

  // const role = form.watch("role"); // non più usato

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Registrazione semplificata: ruolo di default gestito dal backend (final_user)
      const result = await signUp(
        values.email,
        values.password,
        values.full_name
        // ruolo e campi sponsor rimossi
      );

      if (result.success) {
        toast({
          title: t('auth.register.success_title', 'Registrazione completata!'),
          description: t("auth.register.success_desc", "Controlla la tua email per confermare l'account e completare la registrazione."),
          duration: 10000,
        });
        form.reset();
      } else {
        toast({
          title: t('auth.register.error_title', 'Errore di registrazione'),
          description: result.error || t('auth.register.error_generic', 'Si è verificato un errore durante la registrazione.'),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: t('common.unexpected_error', 'Errore imprevisto'),
        description: t('auth.register.error_try_later', 'Si è verificato un errore durante la registrazione. Riprova più tardi.'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Sezione ruolo rimossa: tutti gli iscritti sono utenti finali (final_user)
          <FormField control={form.control} name="role" render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>{t('auth.register.form.role_label', 'Tipo di account')}</FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                  <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="final_user" /></FormControl><FormLabel className="font-normal">{t('auth.register.form.role_user', 'Utente')}</FormLabel></FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="instructor" /></FormControl><FormLabel className="font-normal">{t('auth.register.form.role_instructor', 'Organizzatore')}</FormLabel></FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="company" /></FormControl><FormLabel className="font-normal">{t('auth.register.form.role_company', 'Sponsor')}</FormLabel></FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/> 
          */}

      <FormField control={form.control} name="full_name" render={({ field }) => (
        <FormItem><FormLabel>{t('auth.register.form.fullname_label', 'Nome e Cognome')}</FormLabel><FormControl><Input placeholder={t('auth.register.form.fullname_placeholder', 'Mario Rossi')} {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
      <FormField control={form.control} name="email" render={({ field }) => (
        <FormItem><FormLabel>{t('auth.register.form.email_label', 'Email')}</FormLabel><FormControl><Input placeholder={t('auth.register.form.email_placeholder', 'tua@email.com')} {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
      <FormField control={form.control} name="password" render={({ field }) => (
        <FormItem><FormLabel>{t('auth.register.form.password_label', 'Password')}</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>

          {/** Campi aziendali rimossi in questa fase (mantenuti per eventuale riutilizzo futuro)
          {role === "company" && (
            <>
              <FormField control={form.control} name="company_name" render={({ field }) => (
                <FormItem><FormLabel>{t('auth.register.form.company_name_label', 'Nome Sponsor')}</FormLabel><FormControl><Input placeholder={t('auth.register.form.company_name_placeholder', 'WeApnea SRL')} {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="vat_number" render={({ field }) => (
                <FormItem><FormLabel>{t('auth.register.form.vat_number_label', 'Partita IVA')}</FormLabel><FormControl><Input placeholder={t('auth.register.form.vat_number_placeholder', 'IT12345678901')} {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="company_address" render={({ field }) => (
                <FormItem><FormLabel>{t('auth.register.form.company_address_label', 'Indirizzo Sponsor')}</FormLabel><FormControl><Input placeholder={t('auth.register.form.company_address_placeholder', 'Via Roma 1, 00100 Roma')} {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
            </>
          )}
          */}
      <Button type="submit" disabled={isLoading} className="w-full">
      {isLoading ? t('auth.register.form.submitting', 'Registrazione...') : t('common.register', 'Registrati')}
          </Button>
        </form>
      </Form>
    </div>
  );
};

export default RegisterForm;
