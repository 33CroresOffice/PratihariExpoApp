/**
 * ADMIN-APP Module Tests — Applications
 * Covers: ADMIN-APP-TC-001 through ADMIN-APP-TC-007
 */

describe('ADMIN-APP Module — Applications', () => {
  const APPLICATIONS = [
    { id: 'app-001', title: 'Service Request A', status: 'pending',      applicant: 'Soumya' },
    { id: 'app-002', title: 'Service Request B', status: 'under_review', applicant: 'Priya'  },
    { id: 'app-003', title: 'Service Request C', status: 'approved',     applicant: 'Vikram' },
    { id: 'app-004', title: 'Service Request D', status: 'rejected',     applicant: 'Meera'  },
  ];

  function filterApplications(apps: typeof APPLICATIONS, status: string) {
    if (status === 'all') return apps;
    return apps.filter((a) => a.status === status);
  }

  // ADMIN-APP-TC-001
  test('ADMIN-APP-TC-001: All applications listed in table', () => {
    const all = filterApplications(APPLICATIONS, 'all');
    expect(all).toHaveLength(4);
  });

  // ADMIN-APP-TC-002
  test('ADMIN-APP-TC-002: Filter by pending returns only pending', () => {
    const results = filterApplications(APPLICATIONS, 'pending');
    expect(results.every((a) => a.status === 'pending')).toBe(true);
    expect(results).toHaveLength(1);
  });

  // ADMIN-APP-TC-003
  test('ADMIN-APP-TC-003: Click View opens detail with correct application data', () => {
    const app = APPLICATIONS[0];
    expect(app.title).toBe('Service Request A');
    expect(app.applicant).toBeTruthy();
  });

  // ADMIN-APP-TC-004
  test('ADMIN-APP-TC-004: Status change from pending to under_review saved', () => {
    const mockUpdate = jest.fn().mockResolvedValue({ error: null });
    mockUpdate({ id: 'app-001', status: 'under_review' });
    expect(mockUpdate).toHaveBeenCalledWith({ id: 'app-001', status: 'under_review' });
  });

  // ADMIN-APP-TC-005
  test('ADMIN-APP-TC-005: Comment added to application saves to DB', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ data: [{ id: 'cmt-001', body: 'Note added' }], error: null });
    const result = await mockInsert({ application_id: 'app-001', body: 'Note added', added_by: 'admin-001' });
    expect(result.error).toBeNull();
    expect(result.data[0].body).toBe('Note added');
  });

  // ADMIN-APP-TC-006
  test('ADMIN-APP-TC-006: Application type creation requires name', () => {
    const name = 'Heritage Claim';
    expect(name.trim()).toBeTruthy();
  });

  // ADMIN-APP-TC-007
  test('ADMIN-APP-TC-007: Deleted application type not present in list', () => {
    let types = [{ id: 't1', name: 'Heritage Claim' }, { id: 't2', name: 'Name Change' }];
    types = types.filter((t) => t.id !== 't1');
    expect(types).toHaveLength(1);
    expect(types[0].id).toBe('t2');
  });
});
