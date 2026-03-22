import ThemeRegistry from '@/app/providers/ThemeRegistry';

const MainLayout = ({ children }) => {
  return (
    <ThemeRegistry>
      <div className="flex-1 flex flex-col bg-[#F8FAFC]">{children}</div>
    </ThemeRegistry>
  );
};

export default MainLayout;
