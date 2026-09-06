import { Link } from 'react-router-dom';
import { PageBody } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { EmptyState } from '../components/common/states';

export function NotFoundPage(): JSX.Element {
  return (
    <>
      <TopBar title="Not found" showFilters={false} />
      <PageBody>
        <div className="card">
          <EmptyState
            title="That page does not exist"
            message="The link may be out of date."
            action={
              <Link className="btn ghost sm" to="/">
                Back to the overview
              </Link>
            }
          />
        </div>
      </PageBody>
    </>
  );
}
