import React from 'react';
import { Scan, Camera, Zap, LayoutTemplate } from 'lucide-react';
import { cn } from '../utils/cn'; // Assuming utils/cn exists, otherwise I'll use simple string concat or check for classnames utility

interface SideNavBarProps {
    activePanels: string[];
    onTogglePanel: (panel: 'reverse' | 'angle' | 'runninghub' | 'batch-cover') => void;
}

const SideNavBar: React.FC<SideNavBarProps> = ({ activePanels, onTogglePanel }) => {
    const NavItem = ({
        panel,
        icon: Icon,
        label
    }: {
        panel: 'reverse' | 'angle' | 'runninghub' | 'batch-cover',
        icon: React.ElementType,
        label: string
    }) => {
        const isActive = activePanels.includes(panel);

        return (
            <button
                onClick={() => onTogglePanel(panel)}
                className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 group relative",
                    isActive
                        ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
                title={label}
            >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />

                {/* Tooltip */}
                <span className="absolute left-14 px-2 py-1 bg-gray-900 border border-white/10 rounded-md text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                    {label}
                </span>

                {/* Active Indicator */}
                {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r-full" />
                )}
            </button>
        );
    };

    return (
        <div className="flex flex-col items-center py-4 gap-4 w-[60px] border-r border-white/5 bg-black/20 backdrop-blur-md h-full z-20">
            <NavItem panel="reverse" icon={Scan} label="圖片反推 (Image to Prompt)" />
            <NavItem panel="angle" icon={Camera} label="角度控制 (Angle Control)" />
            <div className="w-8 h-[1px] bg-white/5 my-1" />
            <NavItem panel="batch-cover" icon={LayoutTemplate} label="批量封面 (Batch Cover)" />
            <div className="w-8 h-[1px] bg-white/5 my-1" />
            <NavItem panel="runninghub" icon={Zap} label="Mini RunningHub" />
        </div>
    );
};

export default SideNavBar;
