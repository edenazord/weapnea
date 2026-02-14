import { ReactNode } from 'react';

type PageHeaderProps = {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  align?: 'center' | 'left';
};

export default function PageHeader({ icon, title, subtitle, actions, align = 'center' }: PageHeaderProps) {
  const isLeft = align === 'left';
  return (
    <div className={`${isLeft ? 'text-left' : 'text-center'} mb-12 relative`}>
      <div className={`flex items-center ${isLeft ? 'justify-start' : 'justify-center'} gap-3 mb-4`}>
        {icon && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
            {icon}
          </div>
        )}
      </div>
  <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-900 via-purple-700 to-blue-900 bg-clip-text text-transparent leading-normal pb-3">
        {title}
      </h1>
      {subtitle && (
        <p className={`text-base md:text-xl text-gray-600 ${isLeft ? 'max-w-3xl' : 'max-w-4xl mx-auto'} leading-relaxed whitespace-pre-line`}>
          {subtitle}
        </p>
      )}
      {actions && (
        <div className={`mt-6 flex items-center ${isLeft ? 'justify-start' : 'justify-center'} gap-3 flex-wrap`}>
          {actions}
        </div>
      )}
    </div>
  );
}
