/**
 * Settings.
 *
 * The only screen whose figures are configuration rather than money, so the
 * global month and building pickers are hidden. Everything here still comes
 * from the API: buildings, hostel details, expense categories and the row
 * counts behind "Your data".
 */
import { TopBar } from '../components/layout/TopBar';
import { PageBody } from '../components/layout/AppShell';
import { BuildingsCard } from '../components/settings/BuildingsCard';
import { HostelDetailsCard } from '../components/settings/HostelDetailsCard';
import { DataCard } from '../components/settings/DataCard';
import { UsersCard } from '../components/settings/UsersCard';

export function SettingsPage(): JSX.Element {
  return (
    <>
      <TopBar title="Settings" showFilters={false} />
      <PageBody>
        <div className="grid2">
          <div className="stack">
            <BuildingsCard />
            <HostelDetailsCard />
          </div>
          <div className="stack">
            <DataCard />
            <UsersCard />
          </div>
        </div>
      </PageBody>
    </>
  );
}
